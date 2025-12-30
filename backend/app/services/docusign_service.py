"""DocuSign eSignature service for contract signing using JWT authentication."""
import logging
import base64
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.models.settings import SiteSettings
from app.models.contract import ContractSignature, SignatureStatus

logger = logging.getLogger(__name__)


class DocuSignService:
    """Service for interacting with DocuSign eSignature API."""

    # DocuSign base URLs
    DEMO_BASE_URL = "https://demo.docusign.net/restapi"
    PROD_BASE_URL = "https://na4.docusign.net/restapi"
    DEMO_AUTH_URL = "https://account-d.docusign.com"
    PROD_AUTH_URL = "https://account.docusign.com"

    def __init__(self, db: Session):
        self.db = db
        self._settings: Optional[SiteSettings] = None
        self._api_client = None
        self._access_token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None

    @property
    def settings(self) -> Optional[SiteSettings]:
        """Get cached settings or load from database."""
        if self._settings is None:
            self._settings = self.db.query(SiteSettings).first()
        return self._settings

    @property
    def is_configured(self) -> bool:
        """Check if DocuSign is properly configured."""
        if not self.settings:
            return False
        return bool(
            self.settings.docusign_enabled
            and self.settings.docusign_integration_key
            and self.settings.docusign_account_id
            and self.settings.docusign_user_id
            and self.settings.docusign_private_key
        )

    @property
    def is_test_mode(self) -> bool:
        """Check if running in test/demo mode."""
        return self.settings.docusign_test_mode if self.settings else True

    @property
    def base_url(self) -> str:
        """Get the appropriate base URL based on mode."""
        if self.settings and self.settings.docusign_base_url:
            return self.settings.docusign_base_url
        return self.DEMO_BASE_URL if self.is_test_mode else self.PROD_BASE_URL

    @property
    def auth_url(self) -> str:
        """Get the appropriate auth URL based on mode."""
        return self.DEMO_AUTH_URL if self.is_test_mode else self.PROD_AUTH_URL

    def _get_jwt_token(self) -> str:
        """
        Get or refresh JWT access token for DocuSign API.
        Uses the RSA private key to generate a JWT grant token.
        """
        if self._access_token and self._token_expiry and datetime.utcnow() < self._token_expiry:
            return self._access_token

        if not self.is_configured:
            raise ValueError("DocuSign is not configured. Please configure settings.")

        try:
            from docusign_esign import ApiClient
            from docusign_esign.client.api_exception import ApiException

            api_client = ApiClient()
            api_client.set_oauth_host_name(
                "account-d.docusign.com" if self.is_test_mode else "account.docusign.com"
            )

            # Request JWT token using private key
            # The token is valid for 1 hour
            private_key = self.settings.docusign_private_key.encode('utf-8')

            response = api_client.request_jwt_user_token(
                client_id=self.settings.docusign_integration_key,
                user_id=self.settings.docusign_user_id,
                oauth_host_name=api_client.oauth_host_name,
                private_key_bytes=private_key,
                expires_in=3600,  # 1 hour
                scopes=["signature", "impersonation"]
            )

            self._access_token = response.access_token
            self._token_expiry = datetime.utcnow() + timedelta(seconds=3500)  # Refresh 100s before expiry

            logger.info("DocuSign JWT token obtained successfully")
            return self._access_token

        except ImportError:
            logger.error("DocuSign library not installed. Run: pip install docusign-esign")
            raise ImportError("DocuSign library required. Install with: pip install docusign-esign")
        except ApiException as e:
            logger.error(f"DocuSign API error during authentication: {e}")
            raise

    def _get_api_client(self):
        """Get configured DocuSign API client with valid token."""
        try:
            from docusign_esign import ApiClient

            if self._api_client is None:
                self._api_client = ApiClient()

            token = self._get_jwt_token()
            self._api_client.host = self.base_url
            self._api_client.set_default_header("Authorization", f"Bearer {token}")

            return self._api_client

        except ImportError:
            logger.error("DocuSign library not installed")
            raise

    def create_envelope_for_signature(
        self,
        pdf_bytes: bytes,
        pdf_filename: str,
        signer_email: str,
        signer_name: str,
        subject: str,
        message: str,
        return_url: str
    ) -> dict:
        """
        Create a DocuSign envelope with a PDF document for signing.

        Args:
            pdf_bytes: The PDF document content as bytes
            pdf_filename: Name of the PDF file
            signer_email: Email of the signer
            signer_name: Name of the signer
            subject: Email subject for the signing request
            message: Email body message
            return_url: URL to redirect to after signing

        Returns:
            dict with envelope_id and signing_url or error
        """
        if not self.is_configured:
            return {
                "success": False,
                "error": "DocuSign not configured. Check settings."
            }

        if self.is_test_mode:
            # In test mode, simulate envelope creation
            test_envelope_id = f"TEST-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            logger.info(
                f"[TEST MODE] DocuSign envelope created: {test_envelope_id} "
                f"for {signer_name} ({signer_email})"
            )
            return {
                "success": True,
                "test_mode": True,
                "envelope_id": test_envelope_id,
                "signing_url": f"{return_url}?event=signing_complete&envelope_id={test_envelope_id}"
            }

        try:
            from docusign_esign import EnvelopesApi, EnvelopeDefinition, Document, Signer, SignHere, Tabs, Recipients

            api_client = self._get_api_client()
            envelopes_api = EnvelopesApi(api_client)

            # Encode PDF as base64
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')

            # Create document
            document = Document(
                document_base64=pdf_base64,
                name=pdf_filename,
                file_extension="pdf",
                document_id="1"
            )

            # Create sign here tab (signature location)
            # Using anchor string for automatic placement
            sign_here = SignHere(
                anchor_string="/sig1/",
                anchor_units="pixels",
                anchor_x_offset="20",
                anchor_y_offset="10"
            )

            # Create signer with recipient ID
            signer = Signer(
                email=signer_email,
                name=signer_name,
                recipient_id="1",
                routing_order="1",
                client_user_id="1000",  # Embedded signing requires this
                tabs=Tabs(sign_here_tabs=[sign_here])
            )

            # Create envelope definition
            envelope_definition = EnvelopeDefinition(
                email_subject=subject,
                email_blurb=message,
                documents=[document],
                recipients=Recipients(signers=[signer]),
                status="sent"  # Send immediately
            )

            # Create the envelope
            envelope = envelopes_api.create_envelope(
                account_id=self.settings.docusign_account_id,
                envelope_definition=envelope_definition
            )

            logger.info(f"DocuSign envelope created: {envelope.envelope_id}")

            # Get embedded signing URL
            signing_url = self.get_embedded_signing_url(
                envelope_id=envelope.envelope_id,
                signer_email=signer_email,
                signer_name=signer_name,
                return_url=return_url
            )

            return {
                "success": True,
                "envelope_id": envelope.envelope_id,
                "signing_url": signing_url.get("url") if signing_url.get("success") else None,
                "status": envelope.status
            }

        except Exception as e:
            logger.error(f"Failed to create DocuSign envelope: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_embedded_signing_url(
        self,
        envelope_id: str,
        signer_email: str,
        signer_name: str,
        return_url: str
    ) -> dict:
        """
        Get the embedded signing URL for a signer.

        Args:
            envelope_id: The DocuSign envelope ID
            signer_email: Email of the signer
            signer_name: Name of the signer
            return_url: URL to redirect to after signing

        Returns:
            dict with url or error
        """
        if not self.is_configured:
            return {
                "success": False,
                "error": "DocuSign not configured."
            }

        if self.is_test_mode:
            return {
                "success": True,
                "test_mode": True,
                "url": f"{return_url}?event=signing_complete&envelope_id={envelope_id}"
            }

        try:
            from docusign_esign import EnvelopesApi, RecipientViewRequest

            api_client = self._get_api_client()
            envelopes_api = EnvelopesApi(api_client)

            recipient_view_request = RecipientViewRequest(
                authentication_method="none",
                client_user_id="1000",
                recipient_id="1",
                return_url=return_url,
                user_name=signer_name,
                email=signer_email
            )

            results = envelopes_api.create_recipient_view(
                account_id=self.settings.docusign_account_id,
                envelope_id=envelope_id,
                recipient_view_request=recipient_view_request
            )

            return {
                "success": True,
                "url": results.url
            }

        except Exception as e:
            logger.error(f"Failed to get signing URL: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_envelope_status(self, envelope_id: str) -> dict:
        """
        Get the current status of an envelope.

        Args:
            envelope_id: The DocuSign envelope ID

        Returns:
            dict with status information or error
        """
        if not self.is_configured:
            return {
                "success": False,
                "error": "DocuSign not configured."
            }

        if self.is_test_mode and envelope_id.startswith("TEST-"):
            return {
                "success": True,
                "test_mode": True,
                "envelope_id": envelope_id,
                "status": "completed"
            }

        try:
            from docusign_esign import EnvelopesApi

            api_client = self._get_api_client()
            envelopes_api = EnvelopesApi(api_client)

            envelope = envelopes_api.get_envelope(
                account_id=self.settings.docusign_account_id,
                envelope_id=envelope_id
            )

            return {
                "success": True,
                "envelope_id": envelope_id,
                "status": envelope.status,
                "status_changed_date_time": envelope.status_changed_date_time,
                "created_date_time": envelope.created_date_time
            }

        except Exception as e:
            logger.error(f"Failed to get envelope status: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def download_signed_document(self, envelope_id: str) -> dict:
        """
        Download the signed PDF document from an envelope.

        Args:
            envelope_id: The DocuSign envelope ID

        Returns:
            dict with pdf_bytes or error
        """
        if not self.is_configured:
            return {
                "success": False,
                "error": "DocuSign not configured."
            }

        if self.is_test_mode and envelope_id.startswith("TEST-"):
            # Return a placeholder PDF for test mode
            return {
                "success": True,
                "test_mode": True,
                "envelope_id": envelope_id,
                "pdf_bytes": b"%PDF-1.4 TEST SIGNED DOCUMENT"
            }

        try:
            from docusign_esign import EnvelopesApi

            api_client = self._get_api_client()
            envelopes_api = EnvelopesApi(api_client)

            # Get the combined PDF document
            pdf_bytes = envelopes_api.get_document(
                account_id=self.settings.docusign_account_id,
                envelope_id=envelope_id,
                document_id="combined"
            )

            return {
                "success": True,
                "envelope_id": envelope_id,
                "pdf_bytes": pdf_bytes
            }

        except Exception as e:
            logger.error(f"Failed to download signed document: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def void_envelope(self, envelope_id: str, reason: str) -> dict:
        """
        Void (cancel) an envelope.

        Args:
            envelope_id: The DocuSign envelope ID
            reason: Reason for voiding

        Returns:
            dict with success status or error
        """
        if not self.is_configured:
            return {
                "success": False,
                "error": "DocuSign not configured."
            }

        if self.is_test_mode and envelope_id.startswith("TEST-"):
            logger.info(f"[TEST MODE] DocuSign envelope voided: {envelope_id}, reason: {reason}")
            return {
                "success": True,
                "test_mode": True,
                "envelope_id": envelope_id,
                "voided": True
            }

        try:
            from docusign_esign import EnvelopesApi, Envelope

            api_client = self._get_api_client()
            envelopes_api = EnvelopesApi(api_client)

            envelope = Envelope(status="voided", voided_reason=reason)

            envelopes_api.update(
                account_id=self.settings.docusign_account_id,
                envelope_id=envelope_id,
                envelope=envelope
            )

            logger.info(f"DocuSign envelope voided: {envelope_id}")
            return {
                "success": True,
                "envelope_id": envelope_id,
                "voided": True
            }

        except Exception as e:
            logger.error(f"Failed to void envelope: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def update_signature_status_from_event(
        self,
        signature: ContractSignature,
        event: str
    ) -> SignatureStatus:
        """
        Update signature status based on DocuSign callback event.

        Args:
            signature: The ContractSignature to update
            event: The DocuSign event type (signing_complete, decline, etc.)

        Returns:
            The new SignatureStatus
        """
        event_to_status = {
            "signing_complete": SignatureStatus.SIGNED,
            "decline": SignatureStatus.DECLINED,
            "cancel": SignatureStatus.VOIDED,
            "exception": SignatureStatus.DECLINED,
            "ttl_expired": SignatureStatus.VOIDED,
        }

        new_status = event_to_status.get(event, signature.status)

        if new_status == SignatureStatus.SIGNED:
            signature.signed_at = datetime.utcnow()

        signature.status = new_status
        return new_status


def get_docusign_service(db: Session) -> DocuSignService:
    """Factory function to create DocuSign service instance."""
    return DocuSignService(db)
