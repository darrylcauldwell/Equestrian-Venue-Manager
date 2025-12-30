"""
Environment Agency Flood Monitoring API Integration

API Documentation: https://environment.data.gov.uk/flood-monitoring/doc/reference

This service provides integration with the UK Environment Agency's real-time
flood monitoring data, including river levels and flood warnings.
"""

import httpx
from typing import Optional, Dict, List, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class FloodAPIService:
    """Service for interacting with Environment Agency flood monitoring API."""

    BASE_URL = "https://environment.data.gov.uk/flood-monitoring"
    TIMEOUT = 10.0  # seconds

    @classmethod
    async def _get(cls, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make a GET request to the API."""
        url = f"{cls.BASE_URL}{endpoint}"
        try:
            async with httpx.AsyncClient(timeout=cls.TIMEOUT) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            logger.error(f"Timeout fetching {url}")
            return None
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error {e.response.status_code} fetching {url}")
            return None
        except Exception as e:
            logger.error(f"Error fetching {url}: {str(e)}")
            return None

    @classmethod
    def _get_sync(cls, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make a synchronous GET request to the API."""
        url = f"{cls.BASE_URL}{endpoint}"
        try:
            with httpx.Client(timeout=cls.TIMEOUT) as client:
                response = client.get(url, params=params)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            logger.error(f"Timeout fetching {url}")
            return None
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error {e.response.status_code} fetching {url}")
            return None
        except Exception as e:
            logger.error(f"Error fetching {url}: {str(e)}")
            return None

    @classmethod
    async def search_stations(
        cls,
        search_term: Optional[str] = None,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        dist_km: float = 10.0
    ) -> List[Dict]:
        """
        Search for monitoring stations.

        Args:
            search_term: Search by station or river name
            lat, lon: Search by location (requires both)
            dist_km: Distance in km for location search

        Returns:
            List of station dictionaries with id, label, riverName, lat, long
        """
        params = {}

        if lat is not None and lon is not None:
            params["lat"] = lat
            params["long"] = lon
            params["dist"] = dist_km

        if search_term:
            params["search"] = search_term

        # Only get level monitoring stations
        params["parameter"] = "level"
        params["_limit"] = 50

        data = await cls._get("/id/stations", params)
        if not data or "items" not in data:
            return []

        stations = []
        for item in data["items"]:
            # Handle both formats (some stations have different structures)
            station_id = item.get("stationReference") or item.get("@id", "").split("/")[-1]
            river_name = item.get("riverName", "")

            # Get label/name
            label = item.get("label", "")
            if isinstance(label, list):
                label = label[0] if label else ""

            stations.append({
                "station_id": station_id,
                "label": label,
                "river_name": river_name,
                "lat": item.get("lat"),
                "long": item.get("long"),
                "catchment_name": item.get("catchmentName", ""),
                "town": item.get("town", ""),
            })

        return stations

    @classmethod
    async def get_station_info(cls, station_id: str) -> Optional[Dict]:
        """
        Get detailed information about a monitoring station.

        Args:
            station_id: The Environment Agency station reference ID

        Returns:
            Station information dictionary or None if not found
        """
        data = await cls._get(f"/id/stations/{station_id}")
        if not data or "items" not in data:
            return None

        item = data["items"]
        if isinstance(item, list):
            item = item[0] if item else None

        if not item:
            return None

        # Get typical and max ranges
        measures = item.get("measures", [])
        if isinstance(measures, dict):
            measures = [measures]

        typical_range_high = None
        typical_range_low = None

        for measure in measures:
            if measure.get("parameter") == "level":
                typical_range_low = measure.get("typicalRangeLow")
                typical_range_high = measure.get("typicalRangeHigh")
                break

        label = item.get("label", "")
        if isinstance(label, list):
            label = label[0] if label else ""

        return {
            "station_id": station_id,
            "label": label,
            "river_name": item.get("riverName", ""),
            "lat": item.get("lat"),
            "long": item.get("long"),
            "catchment_name": item.get("catchmentName", ""),
            "town": item.get("town", ""),
            "typical_range_low": typical_range_low,
            "typical_range_high": typical_range_high,
            "date_opened": item.get("dateOpened"),
        }

    @classmethod
    async def get_latest_reading(cls, station_id: str) -> Optional[Dict]:
        """
        Get the latest water level reading for a station.

        Args:
            station_id: The Environment Agency station reference ID

        Returns:
            Reading dictionary with value, dateTime, etc. or None
        """
        data = await cls._get(f"/id/stations/{station_id}/readings", {"_sorted": "", "_limit": 1})
        if not data or "items" not in data:
            return None

        items = data["items"]
        if not items:
            return None

        item = items[0]
        return {
            "value": item.get("value"),
            "date_time": item.get("dateTime"),
            "measure": item.get("measure"),
        }

    @classmethod
    def get_latest_reading_sync(cls, station_id: str) -> Optional[Dict]:
        """Synchronous version of get_latest_reading."""
        data = cls._get_sync(f"/id/stations/{station_id}/readings", {"_sorted": "", "_limit": 1})
        if not data or "items" not in data:
            return None

        items = data["items"]
        if not items:
            return None

        item = items[0]
        return {
            "value": item.get("value"),
            "date_time": item.get("dateTime"),
            "measure": item.get("measure"),
        }

    @classmethod
    async def get_readings_history(
        cls,
        station_id: str,
        since_hours: int = 24
    ) -> List[Dict]:
        """
        Get historical readings for a station.

        Args:
            station_id: The Environment Agency station reference ID
            since_hours: How many hours of history to retrieve

        Returns:
            List of readings with value, dateTime
        """
        from datetime import timedelta

        since = datetime.utcnow() - timedelta(hours=since_hours)
        since_str = since.strftime("%Y-%m-%dT%H:%M:%SZ")

        data = await cls._get(
            f"/id/stations/{station_id}/readings",
            {"since": since_str, "_sorted": ""}
        )

        if not data or "items" not in data:
            return []

        return [
            {
                "value": item.get("value"),
                "date_time": item.get("dateTime"),
            }
            for item in data["items"]
        ]

    @classmethod
    async def get_flood_warnings(
        cls,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        county: Optional[str] = None
    ) -> List[Dict]:
        """
        Get current flood warnings.

        Args:
            lat, lon: Filter by location
            county: Filter by county name

        Returns:
            List of active flood warnings
        """
        params = {}

        if county:
            params["county"] = county

        data = await cls._get("/id/floods", params)
        if not data or "items" not in data:
            return []

        warnings = []
        for item in data["items"]:
            # Filter by location if provided
            if lat is not None and lon is not None:
                # Simple bounding box check - within ~10km
                item_lat = item.get("lat")
                item_lon = item.get("long")
                if item_lat and item_lon:
                    if abs(item_lat - lat) > 0.1 or abs(item_lon - lon) > 0.1:
                        continue

            severity = item.get("severityLevel", 4)
            severity_label = {
                1: "Severe Flood Warning",
                2: "Flood Warning",
                3: "Flood Alert",
                4: "Warning no longer in force",
            }.get(severity, "Unknown")

            warnings.append({
                "flood_area_id": item.get("floodAreaID"),
                "description": item.get("description", ""),
                "severity": severity,
                "severity_label": severity_label,
                "message": item.get("message", ""),
                "time_raised": item.get("timeRaised"),
                "time_message_changed": item.get("timeMessageChanged"),
            })

        return warnings

    @classmethod
    def determine_warning_level(
        cls,
        current_level: float,
        typical_high: Optional[float] = None,
        warning_threshold: Optional[float] = None,
        severe_threshold: Optional[float] = None
    ) -> str:
        """
        Determine warning level based on current reading.

        Args:
            current_level: Current water level in meters
            typical_high: Typical high level for the station
            warning_threshold: Custom warning threshold
            severe_threshold: Custom severe threshold

        Returns:
            'normal', 'elevated', 'warning', or 'severe'
        """
        # Use custom thresholds if provided
        if warning_threshold is not None and severe_threshold is not None:
            if current_level >= severe_threshold:
                return "severe"
            elif current_level >= warning_threshold:
                return "warning"
            elif typical_high and current_level >= typical_high * 0.8:
                return "elevated"
            return "normal"

        # Otherwise use typical high as reference
        if typical_high:
            ratio = current_level / typical_high
            if ratio >= 1.5:
                return "severe"
            elif ratio >= 1.2:
                return "warning"
            elif ratio >= 0.9:
                return "elevated"

        return "normal"
