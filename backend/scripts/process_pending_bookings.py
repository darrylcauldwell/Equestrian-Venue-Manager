#!/usr/bin/env python3
"""
Process pending bookings and auto-confirm those ready to be allocated.

This script should be run daily (e.g., via cron) to automatically confirm
pending livery bookings that:
1. Are for tomorrow or earlier
2. Have no confirmed booking conflict

Usage:
    python scripts/process_pending_bookings.py

Cron example (run at 6 AM daily):
    0 6 * * * cd /path/to/backend && python scripts/process_pending_bookings.py

Docker example:
    docker compose exec backend python scripts/process_pending_bookings.py
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from sqlalchemy import and_, or_

from app.database import SessionLocal
from app.models.booking import Booking, BookingStatus


def process_pending_bookings():
    """Auto-confirm pending bookings for tomorrow or earlier with no conflicts."""
    db = SessionLocal()
    try:
        tomorrow = date.today() + relativedelta(days=1)
        tomorrow_end = datetime.combine(tomorrow, datetime.max.time())

        # Find all pending bookings for tomorrow or earlier
        pending_bookings = db.query(Booking).filter(
            Booking.booking_status == BookingStatus.PENDING,
            Booking.start_time <= tomorrow_end
        ).order_by(Booking.created_at.asc()).all()  # First-come, first-served

        print(f"Found {len(pending_bookings)} pending booking(s) to process")

        confirmed_count = 0
        for booking in pending_bookings:
            # Check if there's a confirmed booking that conflicts
            conflict = db.query(Booking).filter(
                Booking.arena_id == booking.arena_id,
                Booking.booking_status == BookingStatus.CONFIRMED,
                Booking.id != booking.id,
                or_(
                    and_(Booking.start_time <= booking.start_time, Booking.end_time > booking.start_time),
                    and_(Booking.start_time < booking.end_time, Booking.end_time >= booking.end_time),
                    and_(Booking.start_time >= booking.start_time, Booking.end_time <= booking.end_time)
                )
            ).first()

            if not conflict:
                # No conflict - auto-confirm
                booking.booking_status = BookingStatus.CONFIRMED
                confirmed_count += 1
                print(f"  Confirmed booking #{booking.id}: {booking.title} at {booking.start_time}")
            else:
                print(f"  Skipped booking #{booking.id}: conflict with booking #{conflict.id}")

        db.commit()
        print(f"\nProcessed {len(pending_bookings)} pending booking(s), confirmed {confirmed_count}")

    except Exception as e:
        print(f"Error processing pending bookings: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    process_pending_bookings()
