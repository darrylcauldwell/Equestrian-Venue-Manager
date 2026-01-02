from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.routers import auth, users, arenas, bookings, horses, health_records, feed, services, notices, professionals, tasks, staff_management, staff_profiles, clinics, lessons, payments, settings, uploads, weather, stables, livery_packages, compliance, turnout, account, backup, rehab, fields, invoices, billing, holiday_livery, contracts, grants, land_features, flood_warnings, feature_flags, risk_assessments, sheep_flocks
from app.services.scheduler import start_scheduler, stop_scheduler
from app.database import SessionLocal
from app.models.settings import SiteSettings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Cache for dev_mode setting to avoid DB query on every request
_dev_mode_cache = {"value": True, "checked": False}


class NoCacheMiddleware(BaseHTTPMiddleware):
    """Middleware to disable browser caching when dev_mode is enabled."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Check dev_mode setting (cached to reduce DB queries)
        if not _dev_mode_cache["checked"]:
            try:
                db = SessionLocal()
                settings_obj = db.query(SiteSettings).first()
                _dev_mode_cache["value"] = settings_obj.dev_mode if settings_obj else True
                _dev_mode_cache["checked"] = True
                db.close()
            except Exception:
                _dev_mode_cache["value"] = True

        # Add no-cache headers when dev_mode is True
        if _dev_mode_cache["value"]:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response


def invalidate_dev_mode_cache():
    """Call this when dev_mode setting changes."""
    _dev_mode_cache["checked"] = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("Starting up Equestrian Venue Manager API...")
    start_scheduler()
    yield
    # Shutdown
    logger.info("Shutting down...")
    stop_scheduler()


app = FastAPI(
    title="Equestrian Venue Manager API",
    description="API for managing equestrian venue bookings and operations",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://192.168.1.80:3000",  # Local network access
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add no-cache middleware (runs after CORS)
app.add_middleware(NoCacheMiddleware)

app.include_router(settings.router, prefix="/api/settings", tags=["Site Settings"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(arenas.router, prefix="/api/arenas", tags=["Arenas"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["Bookings"])
app.include_router(horses.router, prefix="/api/horses", tags=["Horses"])
app.include_router(health_records.router, prefix="/api/horses", tags=["Health Records"])
app.include_router(feed.router, prefix="/api/horses", tags=["Feed Management"])
app.include_router(services.router, prefix="/api/services", tags=["Services"])
app.include_router(notices.router, prefix="/api/notices", tags=["Noticeboard"])
app.include_router(professionals.router, prefix="/api/professionals", tags=["Professional Directory"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Task Management"])
app.include_router(staff_management.router, prefix="/api/staff", tags=["Staff Management"])
app.include_router(staff_profiles.router, prefix="/api/staff-profiles", tags=["Staff Profiles"])
app.include_router(clinics.router, prefix="/api/clinics", tags=["Training Clinics"])
app.include_router(lessons.router, prefix="/api/lessons", tags=["Ad-Hoc Lessons"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["Uploads"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])
app.include_router(stables.router, prefix="/api/stables", tags=["Stables"])
app.include_router(livery_packages.router, prefix="/api/livery-packages", tags=["Livery Packages"])
app.include_router(compliance.router, prefix="/api/compliance", tags=["Compliance Calendar"])
app.include_router(turnout.router, prefix="/api/turnout", tags=["Turnout Requests"])
app.include_router(account.router, prefix="/api/account", tags=["Account & Billing"])
app.include_router(backup.router, prefix="/api/backup", tags=["Backup & Restore"])
app.include_router(rehab.router, prefix="/api", tags=["Care Plans"])
app.include_router(fields.router, prefix="/api", tags=["Fields & Turnout"])
app.include_router(invoices.router, prefix="/api", tags=["Invoices"])
app.include_router(billing.router, prefix="/api", tags=["Livery Billing"])
app.include_router(holiday_livery.router, prefix="/api", tags=["Holiday Livery"])
app.include_router(contracts.router, prefix="/api", tags=["Contract Management"])
app.include_router(grants.router, prefix="/api/grants", tags=["Grants & Schemes"])
app.include_router(land_features.router, prefix="/api/land-features", tags=["Land Features"])
app.include_router(flood_warnings.router, prefix="/api/flood-warnings", tags=["Flood Monitoring"])
app.include_router(feature_flags.router, prefix="/api", tags=["Feature Flags"])
app.include_router(risk_assessments.router, prefix="/api", tags=["Risk Assessments"])
app.include_router(sheep_flocks.router, prefix="/api", tags=["Sheep Flocks"])


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
