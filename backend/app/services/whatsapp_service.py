"""WhatsApp notification service using Twilio API."""
import logging
from enum import Enum
from typing import Optional
from sqlalchemy.orm import Session

from app.models.settings import SiteSettings

logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    """Types of WhatsApp notifications that can be sent."""
    INVOICE = "invoice"
    FEED_ALERTS = "feed_alerts"
    SERVICE_REQUESTS = "service_requests"
    HOLIDAY_LIVERY = "holiday_livery"


class WhatsAppService:
    """Service for sending WhatsApp messages via Twilio."""

    def __init__(self, db: Session):
        self.db = db
        self._settings: Optional[SiteSettings] = None
        self._client = None

    @property
    def settings(self) -> Optional[SiteSettings]:
        """Get cached settings or load from database."""
        if self._settings is None:
            self._settings = self.db.query(SiteSettings).first()
        return self._settings

    @property
    def is_configured(self) -> bool:
        """Check if WhatsApp is properly configured."""
        if not self.settings:
            return False
        return bool(
            self.settings.whatsapp_enabled
            and self.settings.sms_account_sid
            and self.settings.sms_auth_token
            and self.settings.whatsapp_phone_number
        )

    @property
    def is_test_mode(self) -> bool:
        """Check if running in test mode."""
        return self.settings.whatsapp_test_mode if self.settings else True

    def is_notification_enabled(self, notification_type: NotificationType) -> bool:
        """Check if a specific notification type is enabled."""
        if not self.is_configured:
            return False

        type_to_setting = {
            NotificationType.INVOICE: self.settings.whatsapp_notify_invoice,
            NotificationType.FEED_ALERTS: self.settings.whatsapp_notify_feed_alerts,
            NotificationType.SERVICE_REQUESTS: self.settings.whatsapp_notify_service_requests,
            NotificationType.HOLIDAY_LIVERY: self.settings.whatsapp_notify_holiday_livery,
        }

        # Default to True if not explicitly set
        return type_to_setting.get(notification_type, True) is not False

    def _get_client(self):
        """Get or create Twilio client."""
        if self._client is None and self.settings:
            try:
                from twilio.rest import Client
                self._client = Client(
                    self.settings.sms_account_sid,
                    self.settings.sms_auth_token
                )
            except ImportError:
                logger.error("Twilio library not installed. Run: pip install twilio")
                raise ImportError("Twilio library required for WhatsApp messaging")
        return self._client

    def send_message(
        self,
        to: str,
        message: str,
        media_url: Optional[str] = None
    ) -> dict:
        """
        Send a WhatsApp message.

        Args:
            to: Recipient phone number in E.164 format (e.g., +447123456789)
            message: Message body text
            media_url: Optional URL to media to include

        Returns:
            dict with status and message_sid or error
        """
        if not self.is_configured:
            return {
                "success": False,
                "error": "WhatsApp not configured. Check settings."
            }

        # Ensure phone numbers have whatsapp: prefix
        from_number = f"whatsapp:{self.settings.whatsapp_phone_number}"
        to_number = f"whatsapp:{to}" if not to.startswith("whatsapp:") else to

        if self.is_test_mode:
            logger.info(
                f"[TEST MODE] WhatsApp message to {to_number}: {message}"
            )
            return {
                "success": True,
                "test_mode": True,
                "message_sid": "TEST_MODE_SID",
                "to": to_number,
                "body": message
            }

        try:
            client = self._get_client()
            msg_kwargs = {
                "body": message,
                "from_": from_number,
                "to": to_number
            }
            if media_url:
                msg_kwargs["media_url"] = [media_url]

            twilio_message = client.messages.create(**msg_kwargs)

            logger.info(
                f"WhatsApp message sent to {to_number}, SID: {twilio_message.sid}"
            )
            return {
                "success": True,
                "message_sid": twilio_message.sid,
                "to": to_number,
                "status": twilio_message.status
            }

        except Exception as e:
            logger.error(f"Failed to send WhatsApp message: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def send_template_message(
        self,
        to: str,
        template_sid: str,
        variables: Optional[dict] = None
    ) -> dict:
        """
        Send a WhatsApp template message.

        Twilio uses Content Templates for WhatsApp business messaging.

        Args:
            to: Recipient phone number in E.164 format
            template_sid: Twilio Content Template SID
            variables: Variables to substitute in template

        Returns:
            dict with status and message_sid or error
        """
        if not self.is_configured:
            return {
                "success": False,
                "error": "WhatsApp not configured. Check settings."
            }

        from_number = f"whatsapp:{self.settings.whatsapp_phone_number}"
        to_number = f"whatsapp:{to}" if not to.startswith("whatsapp:") else to

        if self.is_test_mode:
            logger.info(
                f"[TEST MODE] WhatsApp template {template_sid} to {to_number}, "
                f"variables: {variables}"
            )
            return {
                "success": True,
                "test_mode": True,
                "message_sid": "TEST_MODE_SID",
                "to": to_number,
                "template_sid": template_sid
            }

        try:
            client = self._get_client()
            msg_kwargs = {
                "from_": from_number,
                "to": to_number,
                "content_sid": template_sid,
            }
            if variables:
                msg_kwargs["content_variables"] = str(variables)

            twilio_message = client.messages.create(**msg_kwargs)

            logger.info(
                f"WhatsApp template sent to {to_number}, SID: {twilio_message.sid}"
            )
            return {
                "success": True,
                "message_sid": twilio_message.sid,
                "to": to_number,
                "status": twilio_message.status
            }

        except Exception as e:
            logger.error(f"Failed to send WhatsApp template: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


    def send_notification(
        self,
        notification_type: NotificationType,
        to: str,
        message: str,
        media_url: Optional[str] = None
    ) -> dict:
        """
        Send a WhatsApp notification if the notification type is enabled.

        This is the preferred method for sending notifications as it checks
        whether the specific notification type is enabled in settings.

        Args:
            notification_type: Type of notification (invoice, feed_alerts, etc.)
            to: Recipient phone number in E.164 format
            message: Message body text
            media_url: Optional URL to media to include

        Returns:
            dict with status, message_sid, or skipped=True if disabled
        """
        if not self.is_notification_enabled(notification_type):
            logger.debug(
                f"WhatsApp notification type '{notification_type.value}' is disabled, skipping"
            )
            return {
                "success": True,
                "skipped": True,
                "reason": f"Notification type '{notification_type.value}' is disabled"
            }

        return self.send_message(to=to, message=message, media_url=media_url)

    # Convenience methods for each notification type
    def notify_invoice(self, to: str, message: str, pdf_url: Optional[str] = None) -> dict:
        """Send invoice/billing notification."""
        return self.send_notification(
            NotificationType.INVOICE,
            to=to,
            message=message,
            media_url=pdf_url
        )

    def notify_feed_alert(self, to: str, message: str) -> dict:
        """Send feed/medication alert notification."""
        return self.send_notification(
            NotificationType.FEED_ALERTS,
            to=to,
            message=message
        )

    def notify_service_request(self, to: str, message: str) -> dict:
        """Send service request status notification."""
        return self.send_notification(
            NotificationType.SERVICE_REQUESTS,
            to=to,
            message=message
        )

    def notify_holiday_livery(self, to: str, message: str) -> dict:
        """Send holiday livery request status notification."""
        return self.send_notification(
            NotificationType.HOLIDAY_LIVERY,
            to=to,
            message=message
        )


def get_whatsapp_service(db: Session) -> WhatsAppService:
    """Factory function to create WhatsApp service instance."""
    return WhatsAppService(db)
