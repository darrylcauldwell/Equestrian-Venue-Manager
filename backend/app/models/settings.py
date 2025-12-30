from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, Date, Text, Boolean, Numeric, JSON
from app.database import Base


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True, index=True)
    venue_name = Column(String(200), nullable=False, default="Equestrian Venue Manager")
    venue_tagline = Column(String(500), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    # Structured address fields
    address_street = Column(String(200), nullable=True)  # Street address / building name
    address_town = Column(String(100), nullable=True)  # Town / city
    address_county = Column(String(100), nullable=True)  # County
    address_postcode = Column(String(10), nullable=True)  # UK postcode (used for weather lookup)
    # Image URLs
    banner_image_url = Column(String(500), nullable=True)
    logo_url = Column(String(500), nullable=True)
    # Location for weather
    venue_latitude = Column(Numeric(10, 6), nullable=True)
    venue_longitude = Column(Numeric(10, 6), nullable=True)
    # Security info (visible to livery only)
    gate_code = Column(String(50), nullable=True)
    key_safe_code = Column(String(50), nullable=True)
    security_info = Column(Text, nullable=True)  # Entry instructions, emergency procedures, etc.
    # What3Words location
    what3words = Column(String(100), nullable=True)  # e.g., "filled.count.soap"
    # Theme customization - Light mode
    theme_primary_color = Column(String(7), nullable=True, default="#3B82F6")  # Hex color
    theme_accent_color = Column(String(7), nullable=True, default="#10B981")  # Hex color
    # Theme customization - Dark mode
    theme_primary_color_dark = Column(String(7), nullable=True, default="#60A5FA")  # Hex color (lighter for dark bg)
    theme_accent_color_dark = Column(String(7), nullable=True, default="#34D399")  # Hex color (lighter for dark bg)
    # Theme general
    theme_font_family = Column(String(50), nullable=True, default="Inter")  # Font family name
    theme_mode = Column(String(10), nullable=True, default="auto")  # light, dark, auto

    # Livery Billing Settings
    livery_billing_day = Column(Integer, nullable=True, default=1)  # Day of month for billing (1-28, default 1st)

    # Livery Booking Rules (per horse basis)
    # All limits default to NULL (no restrictions) except max_advance_days
    livery_max_future_hours_per_horse = Column(Numeric(5, 1), nullable=True)  # Max total hours of future bookings per horse
    livery_max_booking_hours = Column(Numeric(5, 1), nullable=True)  # Max duration per single booking in hours
    livery_min_advance_hours = Column(Integer, nullable=True, default=0)  # Min hours before booking start time
    livery_max_advance_days = Column(Integer, nullable=True, default=30)  # Max days ahead can book (1 month rolling default)
    livery_max_weekly_hours_per_horse = Column(Numeric(5, 1), nullable=True)  # Optional: max hours per week per horse (null = unlimited)
    livery_max_daily_hours_per_horse = Column(Numeric(5, 1), nullable=True)  # Max hours per day per horse

    # Rugging guide - JSON matrix of rug weight suggestions by temperature range and clip type
    # Structure: {"15+": {"unclipped": "None", "partial": "0g", "fully_clipped": "50g"}, ...}
    rugging_guide = Column(JSON, nullable=True)

    # SMS Notification Settings (using Twilio or similar)
    sms_enabled = Column(Boolean, default=False)  # Master toggle for SMS notifications
    sms_provider = Column(String(50), nullable=True, default="twilio")  # twilio, vonage, etc.
    sms_account_sid = Column(String(100), nullable=True)  # Twilio Account SID or equivalent
    sms_auth_token = Column(String(100), nullable=True)  # Twilio Auth Token (stored encrypted)
    sms_from_number = Column(String(20), nullable=True)  # Sender phone number (E.164 format)
    sms_test_mode = Column(Boolean, default=True)  # If true, don't actually send (for testing)

    # WhatsApp Notification Settings (uses same Twilio credentials as SMS)
    whatsapp_enabled = Column(Boolean, default=False)  # Master toggle for WhatsApp notifications
    whatsapp_phone_number = Column(String(20), nullable=True)  # Twilio WhatsApp sender number (E.164 format)
    whatsapp_test_mode = Column(Boolean, default=True)  # If true, log instead of sending
    whatsapp_default_template = Column(String(100), nullable=True)  # Default message template SID
    # Notification type toggles (which events trigger WhatsApp messages)
    whatsapp_notify_invoice = Column(Boolean, default=True)  # Invoice/billing PDF delivery
    whatsapp_notify_feed_alerts = Column(Boolean, default=True)  # Feed low/medication alerts
    whatsapp_notify_service_requests = Column(Boolean, default=True)  # Service request state changes
    whatsapp_notify_holiday_livery = Column(Boolean, default=True)  # Holiday livery request state changes

    # Stripe Payment Settings
    stripe_enabled = Column(Boolean, default=False)  # Master toggle for Stripe payments
    stripe_secret_key = Column(String(200), nullable=True)  # Stripe Secret Key (sk_test_... or sk_live_...)
    stripe_publishable_key = Column(String(200), nullable=True)  # Stripe Publishable Key (pk_test_... or pk_live_...)
    stripe_webhook_secret = Column(String(200), nullable=True)  # Stripe Webhook Secret (whsec_...)

    # DocuSign Settings (for contract signing)
    docusign_enabled = Column(Boolean, default=False)  # Master toggle for DocuSign integration
    docusign_integration_key = Column(String(100), nullable=True)  # Client ID / Integration Key
    docusign_account_id = Column(String(100), nullable=True)  # DocuSign Account ID
    docusign_user_id = Column(String(100), nullable=True)  # API Username / User ID for JWT auth
    docusign_private_key = Column(Text, nullable=True)  # RSA Private Key for JWT authentication
    docusign_test_mode = Column(Boolean, default=True)  # If true, use demo.docusign.net
    docusign_base_url = Column(String(200), nullable=True)  # Base URL for API calls (auto-set based on test_mode)

    # Application Configuration
    access_token_expire_minutes = Column(Integer, nullable=True, default=30)  # JWT access token lifetime
    refresh_token_expire_days = Column(Integer, nullable=True, default=7)  # JWT refresh token lifetime
    frontend_url = Column(String(200), nullable=True, default="http://localhost:3000")  # Frontend URL for redirects

    # Demo Data Settings
    demo_data_enabled = Column(Boolean, default=False)  # Whether demo data is currently loaded

    # Development Mode Settings
    dev_mode = Column(Boolean, default=True)  # When True, disables caching (default: caching disabled)

    # Feature Flags - JSON object with feature_key: {enabled: bool, group: str, locked: bool}
    # Allows toggling system capabilities on/off for gradual rollout and licensing
    feature_flags = Column(JSON, nullable=True)

    # Turnout cutoff - date when staff triggered cutoff (prevents livery from cancelling)
    turnout_cutoff_date = Column(Date, nullable=True)

    # Scheduler Configuration - times for automated background tasks
    # Health task generation (medications, wound care, health checks, rehab)
    scheduler_health_tasks_hour = Column(Integer, nullable=True, default=0)
    scheduler_health_tasks_minute = Column(Integer, nullable=True, default=1)
    # Task rollover (move incomplete past tasks to backlog)
    scheduler_rollover_hour = Column(Integer, nullable=True, default=0)
    scheduler_rollover_minute = Column(Integer, nullable=True, default=5)
    # Monthly billing (generate livery invoices)
    scheduler_billing_day = Column(Integer, nullable=True, default=1)  # Day of month (1-28)
    scheduler_billing_hour = Column(Integer, nullable=True, default=6)
    scheduler_billing_minute = Column(Integer, nullable=True, default=0)
    # Automated backup
    scheduler_backup_hour = Column(Integer, nullable=True, default=2)
    scheduler_backup_minute = Column(Integer, nullable=True, default=0)
    # Backup cleanup (delete old backups)
    scheduler_cleanup_hour = Column(Integer, nullable=True, default=2)
    scheduler_cleanup_minute = Column(Integer, nullable=True, default=30)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
