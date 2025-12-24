"""Weather API router using Open-Meteo (free, no API key required)."""
import httpx
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.settings import SiteSettings

router = APIRouter()

# Simple in-memory cache
_weather_cache: dict = {
    "data": None,
    "expires_at": None
}
CACHE_DURATION_MINUTES = 30


class ForecastPeriod(BaseModel):
    temp_min: float
    temp_max: float


class WeatherForecast(BaseModel):
    overnight: ForecastPeriod  # Tonight/last night temps
    daytime: ForecastPeriod    # Today's daytime temps
    weather_code: int
    weather_description: str
    timestamp: datetime


class WeatherResponse(BaseModel):
    forecast: WeatherForecast
    location_name: Optional[str] = None
    cached: bool = False


# Weather code descriptions (WMO standard)
WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def get_weather_description(code: int) -> str:
    """Get human-readable weather description from WMO code."""
    return WEATHER_CODES.get(code, "Unknown")


async def geocode_uk_postcode(postcode: str) -> tuple[float, float]:
    """Convert UK postcode to latitude/longitude using postcodes.io (free, no API key)."""
    # Clean postcode - remove spaces and uppercase
    clean_postcode = postcode.replace(" ", "").upper()

    url = f"https://api.postcodes.io/postcodes/{clean_postcode}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 404:
                raise HTTPException(status_code=400, detail=f"Invalid UK postcode: {postcode}")
            response.raise_for_status()
            data = response.json()
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Postcode lookup service timeout")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Postcode lookup error: {str(e)}")

    result = data.get("result", {})
    latitude = result.get("latitude")
    longitude = result.get("longitude")

    if latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail=f"Could not geocode postcode: {postcode}")

    return latitude, longitude


async def fetch_forecast(latitude: float, longitude: float) -> WeatherForecast:
    """Fetch weather forecast from Open-Meteo API."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "weather_code"
        ],
        "hourly": [
            "temperature_2m"
        ],
        "timezone": "auto",
        "forecast_days": 2
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Weather service timeout")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Weather service error: {str(e)}")

    daily = data.get("daily", {})
    hourly = data.get("hourly", {})

    # Get today's and tomorrow's daily data
    today_max = daily.get("temperature_2m_max", [0])[0]
    today_min = daily.get("temperature_2m_min", [0])[0]
    weather_code = daily.get("weather_code", [0])[0]

    # Get hourly temps for more precise overnight/daytime split
    # Overnight: 18:00 - 06:00, Daytime: 06:00 - 18:00
    hourly_temps = hourly.get("temperature_2m", [])
    hourly_times = hourly.get("time", [])

    # Parse hourly data to get overnight and daytime temps for today
    overnight_temps = []
    daytime_temps = []

    for i, time_str in enumerate(hourly_times):
        if i >= len(hourly_temps):
            break
        try:
            hour = datetime.fromisoformat(time_str).hour
            temp = hourly_temps[i]

            # Only look at first 24 hours (today)
            if i < 24:
                if hour < 6 or hour >= 18:
                    overnight_temps.append(temp)
                else:
                    daytime_temps.append(temp)
        except (ValueError, IndexError):
            continue

    # Calculate min/max for each period
    if overnight_temps:
        overnight = ForecastPeriod(
            temp_min=min(overnight_temps),
            temp_max=max(overnight_temps)
        )
    else:
        overnight = ForecastPeriod(temp_min=today_min, temp_max=today_min)

    if daytime_temps:
        daytime = ForecastPeriod(
            temp_min=min(daytime_temps),
            temp_max=max(daytime_temps)
        )
    else:
        daytime = ForecastPeriod(temp_min=today_max, temp_max=today_max)

    return WeatherForecast(
        overnight=overnight,
        daytime=daytime,
        weather_code=weather_code,
        weather_description=get_weather_description(weather_code),
        timestamp=datetime.utcnow()
    )


@router.get("/", response_model=WeatherResponse)
async def get_weather(db: Session = Depends(get_db)):
    """Get weather forecast for the venue location.

    Returns overnight (6pm-6am) and daytime (6am-6pm) temperature ranges.
    Uses Open-Meteo API (free, no API key required).
    Results are cached for 30 minutes.
    """
    global _weather_cache

    # Check cache
    if _weather_cache["data"] and _weather_cache["expires_at"]:
        if datetime.utcnow() < _weather_cache["expires_at"]:
            cached_response = _weather_cache["data"].copy()
            cached_response["cached"] = True
            return cached_response

    # Get venue coordinates from settings
    settings = db.query(SiteSettings).first()

    latitude = None
    longitude = None

    # Priority 1: Use explicit coordinates if set
    if settings and settings.venue_latitude and settings.venue_longitude:
        latitude = float(settings.venue_latitude)
        longitude = float(settings.venue_longitude)

    # Priority 2: Geocode from postcode if coordinates not set
    elif settings and settings.address_postcode:
        latitude, longitude = await geocode_uk_postcode(settings.address_postcode)

    # No location available
    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=404,
            detail="Venue location not configured. Please set a postcode in the address settings."
        )

    # Fetch forecast
    forecast_data = await fetch_forecast(latitude, longitude)

    response_data = {
        "forecast": forecast_data,
        "location_name": settings.venue_name,
        "cached": False
    }

    # Update cache
    _weather_cache["data"] = response_data
    _weather_cache["expires_at"] = datetime.utcnow() + timedelta(minutes=CACHE_DURATION_MINUTES)

    return response_data
