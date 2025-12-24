"""
Stripe payment integration for arena bookings.
"""
from datetime import datetime
from typing import Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.config import get_settings
from app.models.booking import Booking, PaymentStatus
from app.models.settings import SiteSettings

router = APIRouter()
settings = get_settings()


def get_stripe_config(db: Session) -> Tuple[Optional[any], SiteSettings]:
    """
    Get Stripe module configured with database settings.

    Returns:
        Tuple of (stripe_module, site_settings) or (None, site_settings) if not configured
    """
    # Get settings from database
    site_settings = db.query(SiteSettings).first()
    if not site_settings:
        site_settings = SiteSettings(venue_name="Equestrian Venue Manager")
        db.add(site_settings)
        db.commit()
        db.refresh(site_settings)

    # Check if Stripe is enabled and configured
    if not site_settings.stripe_enabled or not site_settings.stripe_secret_key:
        return None, site_settings

    # Import and configure Stripe
    try:
        import stripe as stripe_module
        stripe_module.api_key = site_settings.stripe_secret_key
        return stripe_module, site_settings
    except ImportError:
        return None, site_settings


class CreateCheckoutRequest(BaseModel):
    booking_id: int


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class PaymentStatusResponse(BaseModel):
    booking_id: int
    payment_status: str
    payment_ref: Optional[str] = None


class StripeConfigResponse(BaseModel):
    publishable_key: str
    is_configured: bool


@router.get("/config", response_model=StripeConfigResponse)
def get_stripe_public_config(db: Session = Depends(get_db)):
    """Get Stripe publishable key for frontend"""
    stripe, site_settings = get_stripe_config(db)
    return StripeConfigResponse(
        publishable_key=site_settings.stripe_publishable_key or "",
        is_configured=bool(stripe and site_settings.stripe_publishable_key)
    )


@router.post("/create-checkout", response_model=CheckoutResponse)
def create_checkout_session(
    request: CreateCheckoutRequest,
    db: Session = Depends(get_db)
):
    """Create a Stripe checkout session for a pending booking"""
    stripe, site_settings = get_stripe_config(db)
    if not stripe:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment processing is not configured. Please configure Stripe in Settings."
        )

    # Get the booking
    booking = db.query(Booking).filter(Booking.id == request.booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    if booking.payment_status == PaymentStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking is already paid"
        )

    if booking.payment_status == PaymentStatus.NOT_REQUIRED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment is not required for this booking"
        )

    # Calculate price based on duration and arena pricing
    if not booking.arena.price_per_hour:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arena does not have pricing configured"
        )

    duration_hours = (booking.end_time - booking.start_time).total_seconds() / 3600
    amount = int(duration_hours * float(booking.arena.price_per_hour) * 100)  # Convert to pence

    # Get frontend URL from database
    from app.config import get_app_config
    app_config = get_app_config(db)
    frontend_url = app_config['frontend_url']

    # Format booking time for description
    booking_date = booking.start_time.strftime("%d %B %Y")
    booking_time = f"{booking.start_time.strftime('%H:%M')} - {booking.end_time.strftime('%H:%M')}"

    try:
        # Create Stripe checkout session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'gbp',
                    'product_data': {
                        'name': f'Arena Booking - {booking.arena.name}',
                        'description': f'{booking_date}, {booking_time}',
                    },
                    'unit_amount': amount,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{frontend_url}/public-booking?success=true&booking_id={booking.id}",
            cancel_url=f"{frontend_url}/public-booking?canceled=true&booking_id={booking.id}",
            customer_email=booking.guest_email,
            metadata={
                'booking_id': str(booking.id),
            },
            expires_at=int((datetime.utcnow().timestamp()) + 1800),  # 30 minutes
        )

        # Store the session ID in the booking
        booking.payment_ref = checkout_session.id
        db.commit()

        return CheckoutResponse(
            checkout_url=checkout_session.url,
            session_id=checkout_session.id
        )

    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )


@router.get("/status/{booking_id}", response_model=PaymentStatusResponse)
def get_payment_status(
    booking_id: int,
    db: Session = Depends(get_db)
):
    """Check payment status for a booking"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    return PaymentStatusResponse(
        booking_id=booking.id,
        payment_status=booking.payment_status.value,
        payment_ref=booking.payment_ref
    )


@router.post("/verify/{booking_id}", response_model=PaymentStatusResponse)
def verify_payment(
    booking_id: int,
    db: Session = Depends(get_db)
):
    """Verify payment status with Stripe (for cases where webhook didn't fire)"""
    stripe, site_settings = get_stripe_config(db)
    if not stripe:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment processing is not configured. Please configure Stripe in Settings."
        )

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    if not booking.payment_ref:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No payment session found for this booking"
        )

    try:
        # Check the checkout session status
        session = stripe.checkout.Session.retrieve(booking.payment_ref)

        if session.payment_status == 'paid' and booking.payment_status != PaymentStatus.PAID:
            booking.payment_status = PaymentStatus.PAID
            booking.payment_ref = session.payment_intent  # Update to payment intent ID
            db.commit()

        return PaymentStatusResponse(
            booking_id=booking.id,
            payment_status=booking.payment_status.value,
            payment_ref=booking.payment_ref
        )

    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db)
):
    """Handle Stripe webhook events"""
    stripe, site_settings = get_stripe_config(db)
    if not stripe:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment processing is not configured"
        )

    payload = await request.body()

    # Verify webhook signature if secret is configured
    if site_settings.stripe_webhook_secret:
        try:
            event = stripe.Webhook.construct_event(
                payload, stripe_signature, site_settings.stripe_webhook_secret
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # For development without webhook secret
        import json
        event = json.loads(payload)

    # Handle the checkout.session.completed event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        booking_id = session.get('metadata', {}).get('booking_id')

        if booking_id:
            booking = db.query(Booking).filter(Booking.id == int(booking_id)).first()
            if booking and session['payment_status'] == 'paid':
                booking.payment_status = PaymentStatus.PAID
                booking.payment_ref = session.get('payment_intent', session['id'])
                db.commit()

    # Handle payment_intent.succeeded as backup
    elif event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        # Find booking by payment_ref (which might be checkout session ID)
        # This is a backup in case the checkout.session.completed didn't fire

    return {"status": "success"}


@router.delete("/cancel/{booking_id}")
def cancel_unpaid_booking(
    booking_id: int,
    db: Session = Depends(get_db)
):
    """Cancel an unpaid booking"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    if booking.payment_status == PaymentStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a paid booking through this endpoint"
        )

    db.delete(booking)
    db.commit()

    return {"message": "Booking cancelled"}
