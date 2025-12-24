"""UK-specific validation utilities"""
import re
from typing import Optional


# UK phone number pattern
# Matches: 07700 900000, 07700900000, +447700900000, 01onal 123456, 020 7946 0958, etc.
UK_PHONE_PATTERN = re.compile(
    r'^(?:'
    r'(?:\+44|0044|\(0\)|0)'  # Country code or leading 0
    r'\s*'
    r'(?:[1-9]\d{2,4})'  # Area code
    r'\s*'
    r'(?:\d{3,4})'  # First part
    r'\s*'
    r'(?:\d{3,4})'  # Second part
    r')$',
    re.VERBOSE
)

# Simplified UK phone pattern - more permissive
UK_PHONE_SIMPLE = re.compile(
    r'^(?:\+44|0)[\d\s\-]{9,14}$'
)

# UK postcode pattern
# Matches: SW1A 1AA, M1 1AA, EC1A 1BB, DN55 1PT, etc.
UK_POSTCODE_PATTERN = re.compile(
    r'^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$',
    re.IGNORECASE
)


def validate_uk_phone(phone: Optional[str]) -> Optional[str]:
    """
    Validate and normalize UK phone number.
    Returns the cleaned phone number or raises ValueError.
    """
    if phone is None or phone.strip() == '':
        return None

    # Remove common formatting characters
    cleaned = re.sub(r'[\s\-\(\)]', '', phone.strip())

    # Check if it looks like a UK number
    if not cleaned:
        return None

    # Accept numbers starting with +44, 0044, or 0
    if cleaned.startswith('+44'):
        cleaned = '0' + cleaned[3:]
    elif cleaned.startswith('0044'):
        cleaned = '0' + cleaned[4:]
    elif cleaned.startswith('44') and len(cleaned) > 10:
        cleaned = '0' + cleaned[2:]

    # UK numbers should be 10-11 digits after normalization
    if not cleaned.startswith('0'):
        raise ValueError("UK phone numbers should start with 0 or +44")

    if not cleaned[1:].isdigit():
        raise ValueError("Phone number should contain only digits")

    if len(cleaned) < 10 or len(cleaned) > 11:
        raise ValueError("UK phone numbers should be 10-11 digits")

    # Format nicely: first 5 digits, space, rest
    if len(cleaned) == 11:
        return f"{cleaned[:5]} {cleaned[5:]}"
    else:
        return f"{cleaned[:4]} {cleaned[4:]}"


def validate_uk_postcode(postcode: Optional[str]) -> Optional[str]:
    """
    Validate and normalize UK postcode.
    Returns the cleaned postcode or raises ValueError.
    """
    if postcode is None or postcode.strip() == '':
        return None

    # Remove extra whitespace and uppercase
    cleaned = ' '.join(postcode.upper().split())

    # Ensure there's a space before the last 3 characters
    if len(cleaned) >= 5 and cleaned[-4] != ' ':
        cleaned = cleaned[:-3].strip() + ' ' + cleaned[-3:]

    if not UK_POSTCODE_PATTERN.match(cleaned):
        raise ValueError("Invalid UK postcode format. Example: SW1A 1AA")

    return cleaned


