"""
Enhanced Date Helpers for Seed Data

Provides utilities for calculating dates from seed data specifications.
Supports relative dates, weekly patterns, and recurring schedules.

Supported date formats in seed data:
- days_from_now: 7         # 7 days from today
- days_ago: 3              # 3 days before today
- weeks_from_now: 2        # 2 weeks from today
- weeks_ago: 1             # 1 week before today
- months_from_now: 1       # 1 month from today
- months_ago: 2            # 2 months before today
- next_weekday: 1          # Next Monday (0=Mon, 6=Sun)
- last_weekday: 5          # Last Friday
"""

from datetime import datetime, date, timedelta
from typing import Any, Dict, Optional, Union
from dateutil.relativedelta import relativedelta


def calculate_date(spec: Dict[str, Any], base_date: Optional[date] = None) -> date:
    """
    Calculate a date from a seed data date specification.

    Args:
        spec: Dictionary containing date specification
        base_date: Base date to calculate from (default: today)

    Returns:
        Calculated date

    Examples:
        >>> calculate_date({"days_from_now": 7})  # 7 days from now
        >>> calculate_date({"weeks_ago": 2})       # 2 weeks ago
        >>> calculate_date({"next_weekday": 1})    # Next Monday
    """
    if base_date is None:
        base_date = date.today()

    # Handle days_from_now
    if "days_from_now" in spec:
        return base_date + timedelta(days=spec["days_from_now"])

    # Handle days_ago
    if "days_ago" in spec:
        return base_date - timedelta(days=spec["days_ago"])

    # Handle weeks_from_now
    if "weeks_from_now" in spec:
        return base_date + timedelta(weeks=spec["weeks_from_now"])

    # Handle weeks_ago
    if "weeks_ago" in spec:
        return base_date - timedelta(weeks=spec["weeks_ago"])

    # Handle months_from_now
    if "months_from_now" in spec:
        return base_date + relativedelta(months=spec["months_from_now"])

    # Handle months_ago
    if "months_ago" in spec:
        return base_date - relativedelta(months=spec["months_ago"])

    # Handle next_weekday (0=Monday, 6=Sunday)
    if "next_weekday" in spec:
        target_weekday = spec["next_weekday"]
        current_weekday = base_date.weekday()
        days_ahead = target_weekday - current_weekday
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        return base_date + timedelta(days=days_ahead)

    # Handle last_weekday (0=Monday, 6=Sunday)
    if "last_weekday" in spec:
        target_weekday = spec["last_weekday"]
        current_weekday = base_date.weekday()
        days_back = current_weekday - target_weekday
        if days_back <= 0:  # Target day is later this week
            days_back += 7
        return base_date - timedelta(days=days_back)

    # Handle start_date_days_from_now (for holiday requests)
    if "start_date_days_from_now" in spec:
        return base_date + timedelta(days=spec["start_date_days_from_now"])

    # Handle period_start_months_ago (for invoices)
    if "period_start_months_ago" in spec:
        return base_date - relativedelta(months=spec["period_start_months_ago"])

    # If no relative date found, return base_date
    return base_date


def calculate_datetime(
    spec: Dict[str, Any],
    base_datetime: Optional[datetime] = None,
    hour: Optional[int] = None
) -> datetime:
    """
    Calculate a datetime from a seed data specification.

    Args:
        spec: Dictionary containing date specification
        base_datetime: Base datetime to calculate from (default: now)
        hour: Hour to set on the result (overrides spec["hour"])

    Returns:
        Calculated datetime
    """
    if base_datetime is None:
        base_datetime = datetime.now()

    # Calculate the date part
    result_date = calculate_date(spec, base_datetime.date())

    # Determine the hour
    target_hour = hour if hour is not None else spec.get("hour", 10)

    # Create datetime with the calculated date and specified hour
    return datetime.combine(result_date, datetime.min.time().replace(hour=target_hour))


def get_next_due_date(
    last_date: date,
    interval_weeks: Optional[int] = None,
    interval_months: Optional[int] = None
) -> date:
    """
    Calculate next due date for recurring items (farrier, worming, etc).

    Args:
        last_date: Date of last service/treatment
        interval_weeks: Weeks between treatments (e.g., 6 for farrier)
        interval_months: Months between treatments (e.g., 12 for vaccinations)

    Returns:
        Next due date
    """
    if interval_weeks:
        return last_date + timedelta(weeks=interval_weeks)
    if interval_months:
        return last_date + relativedelta(months=interval_months)
    return last_date


def format_relative_date(target_date: date, base_date: Optional[date] = None) -> str:
    """
    Format a date as a human-readable relative string.

    Args:
        target_date: The date to format
        base_date: Base date to compare against (default: today)

    Returns:
        Human-readable string like "in 3 days", "yesterday", "2 weeks ago"
    """
    if base_date is None:
        base_date = date.today()

    delta = (target_date - base_date).days

    if delta == 0:
        return "today"
    elif delta == 1:
        return "tomorrow"
    elif delta == -1:
        return "yesterday"
    elif delta > 0:
        if delta < 7:
            return f"in {delta} days"
        elif delta < 14:
            return "next week"
        elif delta < 30:
            weeks = delta // 7
            return f"in {weeks} weeks"
        else:
            months = delta // 30
            return f"in {months} month{'s' if months > 1 else ''}"
    else:
        days_ago = abs(delta)
        if days_ago < 7:
            return f"{days_ago} days ago"
        elif days_ago < 14:
            return "last week"
        elif days_ago < 30:
            weeks = days_ago // 7
            return f"{weeks} weeks ago"
        else:
            months = days_ago // 30
            return f"{months} month{'s' if months > 1 else ''} ago"
