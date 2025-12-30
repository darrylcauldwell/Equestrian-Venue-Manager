from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any
from pydantic import BaseModel, field_validator
from app.utils.validators import validate_uk_phone


class SiteSettingsBase(BaseModel):
    venue_name: str = "Equestrian Venue Manager"
    venue_tagline: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    # Structured address fields
    address_street: Optional[str] = None
    address_town: Optional[str] = None
    address_county: Optional[str] = None
    address_postcode: Optional[str] = None
    logo_url: Optional[str] = None
    venue_latitude: Optional[Decimal] = None
    venue_longitude: Optional[Decimal] = None
    gate_code: Optional[str] = None
    key_safe_code: Optional[str] = None
    security_info: Optional[str] = None
    what3words: Optional[str] = None
    # Theme - Light mode
    theme_primary_color: Optional[str] = "#3B82F6"
    theme_accent_color: Optional[str] = "#10B981"
    # Theme - Dark mode
    theme_primary_color_dark: Optional[str] = "#60A5FA"
    theme_accent_color_dark: Optional[str] = "#34D399"
    # Theme general
    theme_font_family: Optional[str] = "Inter"
    theme_mode: Optional[str] = "auto"
    # Livery Billing Settings
    livery_billing_day: Optional[int] = 1  # Day of month for billing (1-28)
    # Livery Booking Rules (per horse basis)
    # All limits default to None (no restrictions) except max_advance_days
    livery_max_future_hours_per_horse: Optional[Decimal] = None
    livery_max_booking_hours: Optional[Decimal] = None
    livery_min_advance_hours: Optional[int] = 0
    livery_max_advance_days: Optional[int] = 30  # 1 month rolling default
    livery_max_weekly_hours_per_horse: Optional[Decimal] = None
    livery_max_daily_hours_per_horse: Optional[Decimal] = None
    # Rugging guide matrix
    rugging_guide: Optional[Dict[str, Any]] = None
    # SMS Notification Settings
    sms_enabled: bool = False
    sms_provider: Optional[str] = "twilio"
    sms_account_sid: Optional[str] = None
    sms_auth_token: Optional[str] = None
    sms_from_number: Optional[str] = None
    sms_test_mode: bool = True
    # WhatsApp Notification Settings (uses same Twilio credentials as SMS)
    whatsapp_enabled: bool = False
    whatsapp_phone_number: Optional[str] = None
    whatsapp_test_mode: bool = True
    whatsapp_default_template: Optional[str] = None
    # WhatsApp notification type toggles
    whatsapp_notify_invoice: bool = True
    whatsapp_notify_feed_alerts: bool = True
    whatsapp_notify_service_requests: bool = True
    whatsapp_notify_holiday_livery: bool = True
    # Stripe Payment Settings
    stripe_enabled: bool = False
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    # Application Configuration
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    frontend_url: str = "http://localhost:3000"
    # Demo Data Settings
    demo_data_enabled: bool = False
    # Development Mode Settings
    dev_mode: bool = True  # When True, disables browser caching
    # Turnout cutoff
    turnout_cutoff_date: Optional[date] = None
    # Scheduler Configuration
    scheduler_health_tasks_hour: int = 0
    scheduler_health_tasks_minute: int = 1
    scheduler_rollover_hour: int = 0
    scheduler_rollover_minute: int = 5
    scheduler_billing_day: int = 1
    scheduler_billing_hour: int = 6
    scheduler_billing_minute: int = 0
    scheduler_backup_hour: int = 2
    scheduler_backup_minute: int = 0
    scheduler_cleanup_hour: int = 2
    scheduler_cleanup_minute: int = 30

    @field_validator('contact_phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_uk_phone(v)


class SiteSettingsUpdate(BaseModel):
    venue_name: Optional[str] = None
    venue_tagline: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    # Structured address fields
    address_street: Optional[str] = None
    address_town: Optional[str] = None
    address_county: Optional[str] = None
    address_postcode: Optional[str] = None
    logo_url: Optional[str] = None
    venue_latitude: Optional[Decimal] = None
    venue_longitude: Optional[Decimal] = None
    gate_code: Optional[str] = None
    key_safe_code: Optional[str] = None
    security_info: Optional[str] = None
    what3words: Optional[str] = None
    # Theme - Light mode
    theme_primary_color: Optional[str] = None
    theme_accent_color: Optional[str] = None
    # Theme - Dark mode
    theme_primary_color_dark: Optional[str] = None
    theme_accent_color_dark: Optional[str] = None
    # Theme general
    theme_font_family: Optional[str] = None
    theme_mode: Optional[str] = None
    # Livery Billing Settings
    livery_billing_day: Optional[int] = None
    # Livery Booking Rules (per horse basis)
    livery_max_future_hours_per_horse: Optional[Decimal] = None
    livery_max_booking_hours: Optional[Decimal] = None
    livery_min_advance_hours: Optional[int] = None
    livery_max_advance_days: Optional[int] = None
    livery_max_weekly_hours_per_horse: Optional[Decimal] = None
    livery_max_daily_hours_per_horse: Optional[Decimal] = None
    # Rugging guide matrix
    rugging_guide: Optional[Dict[str, Any]] = None
    # SMS Notification Settings
    sms_enabled: Optional[bool] = None
    sms_provider: Optional[str] = None
    sms_account_sid: Optional[str] = None
    sms_auth_token: Optional[str] = None
    sms_from_number: Optional[str] = None
    sms_test_mode: Optional[bool] = None
    # WhatsApp Notification Settings
    whatsapp_enabled: Optional[bool] = None
    whatsapp_phone_number: Optional[str] = None
    whatsapp_test_mode: Optional[bool] = None
    whatsapp_default_template: Optional[str] = None
    # WhatsApp notification type toggles
    whatsapp_notify_invoice: Optional[bool] = None
    whatsapp_notify_feed_alerts: Optional[bool] = None
    whatsapp_notify_service_requests: Optional[bool] = None
    whatsapp_notify_holiday_livery: Optional[bool] = None
    # Stripe Payment Settings
    stripe_enabled: Optional[bool] = None
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    # Application Configuration
    access_token_expire_minutes: Optional[int] = None
    refresh_token_expire_days: Optional[int] = None
    frontend_url: Optional[str] = None
    # Development Mode Settings
    dev_mode: Optional[bool] = None
    # Turnout cutoff
    turnout_cutoff_date: Optional[date] = None
    # Scheduler Configuration
    scheduler_health_tasks_hour: Optional[int] = None
    scheduler_health_tasks_minute: Optional[int] = None
    scheduler_rollover_hour: Optional[int] = None
    scheduler_rollover_minute: Optional[int] = None
    scheduler_billing_day: Optional[int] = None
    scheduler_billing_hour: Optional[int] = None
    scheduler_billing_minute: Optional[int] = None
    scheduler_backup_hour: Optional[int] = None
    scheduler_backup_minute: Optional[int] = None
    scheduler_cleanup_hour: Optional[int] = None
    scheduler_cleanup_minute: Optional[int] = None

    @field_validator('contact_phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_uk_phone(v)


class SiteSettingsResponse(SiteSettingsBase):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
