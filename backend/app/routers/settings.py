from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from app.database import get_db
from app.models.user import User, UserRole
from app.models.settings import SiteSettings
from app.models.task import YardTask, HealthTaskType, TaskStatus, AssignmentType
from app.models.staff_management import Shift, ShiftRole
from app.schemas.settings import (
    SiteSettingsResponse, SiteSettingsUpdate,
    SSLSettingsResponse, SSLSettingsUpdate, SSLStatusResponse, CertificateInfo
)
from app.utils.auth import get_current_user
from app.services import scheduler as scheduler_service
from app.services.health_task_generator import HealthTaskGenerator

router = APIRouter()


# Tables that should NOT be truncated (system tables)
PROTECTED_TABLES = ['alembic_version', 'site_settings']

# Tables to preserve admin user (users table needs special handling)
ADMIN_PRESERVED_TABLES = ['users']


def get_or_create_settings(db: Session) -> SiteSettings:
    """Get existing settings or create default ones."""
    settings = db.query(SiteSettings).first()
    if not settings:
        settings = SiteSettings(venue_name="Equestrian Venue Manager")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def has_real_user_data(db: Session, current_admin_id: int) -> tuple[bool, str]:
    """
    Check if the database has real user data that would be corrupted by demo seeding.

    Returns (has_data, reason) tuple.
    """
    # Check for users beyond the current admin
    user_count = db.query(User).filter(User.id != current_admin_id).count()
    if user_count > 0:
        return True, f"There are {user_count} other user(s) in the system"

    # Check for horses
    from app.models.horse import Horse
    horse_count = db.query(Horse).count()
    if horse_count > 0:
        return True, f"There are {horse_count} horse(s) in the system"

    # Check for bookings
    from app.models.booking import Booking
    booking_count = db.query(Booking).count()
    if booking_count > 0:
        return True, f"There are {booking_count} booking(s) in the system"

    # Check for arenas (beyond defaults)
    from app.models.arena import Arena
    arena_count = db.query(Arena).count()
    if arena_count > 0:
        return True, f"There are {arena_count} arena(s) in the system"

    return False, ""


@router.get("/", response_model=SiteSettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    """Get site settings (public endpoint)."""
    return get_or_create_settings(db)


@router.put("/", response_model=SiteSettingsResponse)
def update_settings(
    settings_data: SiteSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update site settings (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update site settings"
        )

    settings = get_or_create_settings(db)

    update_data = settings_data.model_dump(exclude_unset=True)
    dev_mode_changed = 'dev_mode' in update_data and update_data['dev_mode'] != settings.dev_mode

    for field, value in update_data.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)

    # Invalidate cache if dev_mode changed
    if dev_mode_changed:
        from app.main import invalidate_dev_mode_cache
        invalidate_dev_mode_cache()

    return settings


@router.post("/turnout-cutoff")
def trigger_turnout_cutoff(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger turnout cutoff for today (staff/admin only).

    This prevents livery users from cancelling turnout requests for the rest of the day.
    """
    from app.utils.auth import has_staff_access
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required"
        )

    settings = get_or_create_settings(db)
    settings.turnout_cutoff_date = date.today()
    db.commit()
    db.refresh(settings)

    return {
        "message": "Turnout cutoff activated for today",
        "turnout_cutoff_date": settings.turnout_cutoff_date.isoformat()
    }


# ============== WhatsApp Test ==============

@router.post("/whatsapp/test")
def test_whatsapp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test WhatsApp configuration by sending a test message (admin only).

    Sends a test message to the configured WhatsApp number.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can test WhatsApp configuration"
        )

    settings = get_or_create_settings(db)

    if not settings.whatsapp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WhatsApp is not enabled. Enable it in settings first."
        )

    if not settings.whatsapp_phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WhatsApp phone number not configured."
        )

    if not settings.sms_account_sid or not settings.sms_auth_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Twilio credentials (Account SID and Auth Token) are required. Configure them in SMS settings."
        )

    from app.services.whatsapp_service import get_whatsapp_service

    whatsapp = get_whatsapp_service(db)

    # Send test message to the configured number
    result = whatsapp.send_message(
        to=settings.whatsapp_phone_number,
        message=f"Test message from {settings.venue_name or 'Equestrian Venue Manager'}. WhatsApp notifications are working!"
    )

    if result["success"]:
        return {
            "success": True,
            "test_mode": result.get("test_mode", False),
            "message": "Test message sent successfully" if not result.get("test_mode") else "Test mode: message logged but not sent",
            "message_sid": result.get("message_sid")
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send test message: {result.get('error', 'Unknown error')}"
        )


def get_demo_users_by_role() -> dict[str, list[str]]:
    """Load demo users from seed_data.json grouped by role."""
    import json
    from pathlib import Path
    seed_file = Path(__file__).parent.parent.parent / "seed_data.json"
    try:
        with open(seed_file) as f:
            data = json.load(f)
        users_by_role: dict[str, list[str]] = {}
        for user in data.get("users", []):
            role = user.get("role", "unknown")
            users_by_role.setdefault(role, []).append(user["username"])
        return {role: sorted(users) for role, users in users_by_role.items()}
    except Exception:
        return {}


@router.get("/demo-data/status")
def get_demo_data_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if demo data mode is available (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can check demo data status"
        )

    settings = get_or_create_settings(db)
    has_data, reason = has_real_user_data(db, current_user.id)

    return {
        "demo_data_enabled": settings.demo_data_enabled,
        "can_enable_demo": not has_data and not settings.demo_data_enabled,
        "can_clean_demo": settings.demo_data_enabled,
        "has_real_data": has_data,
        "reason": reason if has_data else None,
        "demo_users": get_demo_users_by_role()
    }


@router.post("/demo-data/seed")
def seed_demo_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Seed the database with demo data (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can seed demo data"
        )

    settings = get_or_create_settings(db)

    if settings.demo_data_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Demo data is already enabled. Clean it first before re-seeding."
        )

    # Check for real user data that would be corrupted
    has_data, reason = has_real_user_data(db, current_user.id)
    if has_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot enable demo data: {reason}. Demo mode is only available on a fresh installation."
        )

    try:
        # Import and run the seed function
        from scripts.seed_database import seed_demo_data as run_seed
        run_seed(db)

        # Refresh settings and mark demo data as enabled
        db.refresh(settings)
        settings.demo_data_enabled = True
        db.commit()

        return {"message": "Demo data seeded successfully", "demo_data_enabled": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed demo data: {str(e)}"
        )


@router.post("/demo-data/clean")
def clean_demo_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clean all demo data and reset to empty instance (admin only).

    This will:
    - Save the current admin user's credentials
    - Drop and recreate the public schema
    - Run all Alembic migrations to properly recreate tables and enum types
    - Restore the admin user
    - Create fresh site settings with demo_data_enabled = False
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can clean demo data"
        )

    try:
        # Save admin user details before dropping tables
        admin_data = {
            "email": current_user.email,
            "username": current_user.username,
            "name": current_user.name,
            "password_hash": current_user.password_hash,
            "role": current_user.role,
        }

        # Import required modules
        from app.database import engine, SessionLocal
        from alembic.config import Config
        from alembic import command
        import os

        # Close current session before schema operations
        db.close()

        # Drop and recreate the public schema
        with engine.connect() as conn:
            conn.execute(text("DROP SCHEMA public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO PUBLIC"))
            conn.commit()

        # Run Alembic migrations to properly recreate all tables and enum types
        # This is better than create_all() because it creates enum types correctly
        alembic_cfg = Config()
        alembic_cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "../../alembic"))
        alembic_cfg.set_main_option("sqlalchemy.url", str(engine.url))
        command.upgrade(alembic_cfg, "head")

        # Get fresh session after migrations
        new_db = SessionLocal()

        try:
            # Recreate admin user
            admin_user = User(
                email=admin_data["email"],
                username=admin_data["username"],
                name=admin_data["name"],
                password_hash=admin_data["password_hash"],
                role=admin_data["role"],
                is_active=True,
            )
            new_db.add(admin_user)

            # Create fresh site settings
            settings = SiteSettings(
                venue_name="Equestrian Venue Manager",
                demo_data_enabled=False,
            )
            new_db.add(settings)

            new_db.commit()
        finally:
            new_db.close()

        return {
            "message": "Database reset successfully. All demo data removed.",
            "demo_data_enabled": False,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clean demo data: {str(e)}"
        )


# ============== Scheduler Status ==============

def _get_readable_schedule(job_id: str, settings) -> str:
    """Get human-readable schedule from settings."""
    if job_id == "daily_health_tasks":
        h = settings.scheduler_health_tasks_hour or 0
        m = settings.scheduler_health_tasks_minute or 1
        return f"Daily at {h:02d}:{m:02d}"
    elif job_id == "task_rollover":
        h = settings.scheduler_rollover_hour or 0
        m = settings.scheduler_rollover_minute or 5
        return f"Daily at {h:02d}:{m:02d}"
    elif job_id == "monthly_billing":
        d = settings.scheduler_billing_day or 1
        h = settings.scheduler_billing_hour or 6
        m = settings.scheduler_billing_minute or 0
        suffix = "st" if d == 1 else "nd" if d == 2 else "rd" if d == 3 else "th"
        return f"{d}{suffix} of each month at {h:02d}:{m:02d}"
    elif job_id == "automated_backup":
        h = settings.scheduler_backup_hour or 2
        m = settings.scheduler_backup_minute or 0
        return f"Daily at {h:02d}:{m:02d}"
    elif job_id == "backup_cleanup":
        h = settings.scheduler_cleanup_hour or 2
        m = settings.scheduler_cleanup_minute or 30
        return f"Daily at {h:02d}:{m:02d}"
    return "Unknown schedule"


@router.get("/scheduler/status")
def get_scheduler_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current status of the task scheduler (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view scheduler status"
        )

    # Check if scheduler is running
    sched = scheduler_service._get_scheduler()
    is_running = sched.running if sched else False

    # Get last run info from database
    from app.models.backup import Backup, BackupSchedule

    # Get latest backup for backup job status
    latest_backup = db.query(Backup).order_by(Backup.backup_date.desc()).first()
    backup_schedule = db.query(BackupSchedule).first()

    # Check if health tasks were generated today
    today = date.today()
    todays_health_task_count = db.query(func.count(YardTask.id)).filter(
        YardTask.health_task_type.isnot(None),
        YardTask.scheduled_date == today
    ).scalar() or 0

    # Build job status info
    job_last_runs = {
        "daily_health_tasks": {
            "last_run": today.isoformat() if todays_health_task_count > 0 else None,
            "last_status": "success" if todays_health_task_count > 0 else None,
            "last_summary": f"{todays_health_task_count} tasks created" if todays_health_task_count > 0 else None
        },
        "task_rollover": {
            "last_run": None,  # We don't track this currently
            "last_status": None,
            "last_summary": None
        },
        "monthly_billing": {
            "last_run": None,  # Would need to track this
            "last_status": None,
            "last_summary": None
        },
        "automated_backup": {
            "last_run": backup_schedule.last_run.isoformat() if backup_schedule and backup_schedule.last_run else None,
            "last_status": "success" if latest_backup else None,
            "last_summary": f"Created {latest_backup.filename}" if latest_backup else None
        },
        "backup_cleanup": {
            "last_run": None,
            "last_status": None,
            "last_summary": None
        }
    }

    # Get settings for schedule display
    settings = get_or_create_settings(db)

    # Get scheduled jobs info
    jobs = []
    if sched and is_running:
        for job in sched.get_jobs():
            last_run_info = job_last_runs.get(job.id, {})
            jobs.append({
                "id": job.id,
                "name": job.name,
                "schedule": _get_readable_schedule(job.id, settings),
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "last_run": last_run_info.get("last_run"),
                "last_status": last_run_info.get("last_status"),
                "last_summary": last_run_info.get("last_summary")
            })

    # Count health tasks generated for today
    today = date.today()
    today_tasks = db.query(
        YardTask.health_task_type,
        func.count(YardTask.id).label("count")
    ).filter(
        YardTask.health_task_type.isnot(None),
        YardTask.scheduled_date == today
    ).group_by(YardTask.health_task_type).all()

    task_counts = {
        "medication": 0,
        "wound_care": 0,
        "health_check": 0,
        "rehab_exercise": 0,
        "total": 0
    }

    for task_type, count in today_tasks:
        if task_type == HealthTaskType.MEDICATION:
            task_counts["medication"] = count
        elif task_type == HealthTaskType.WOUND_CARE:
            task_counts["wound_care"] = count
        elif task_type == HealthTaskType.HEALTH_CHECK:
            task_counts["health_check"] = count
        elif task_type == HealthTaskType.REHAB_EXERCISE:
            task_counts["rehab_exercise"] = count
        task_counts["total"] += count

    return {
        "scheduler_running": is_running,
        "jobs": jobs,
        "todays_health_tasks": task_counts,
        "current_date": today.isoformat()
    }


@router.get("/scheduler/preview/{target_date}")
def preview_health_tasks(
    target_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Preview what health tasks would be generated for a given date (admin only).

    This is a dry run that doesn't create any tasks.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can preview task generation"
        )

    # Get system user ID for the generator
    system_user_id = scheduler_service.get_system_user_id(db)
    generator = HealthTaskGenerator(db, system_user_id)

    # Generate tasks in preview mode (we'll query without committing)
    # We need to check what WOULD be generated without creating them

    # Check for existing tasks on that date
    existing_tasks = db.query(
        YardTask.health_task_type,
        func.count(YardTask.id).label("count")
    ).filter(
        YardTask.health_task_type.isnot(None),
        YardTask.scheduled_date == target_date
    ).group_by(YardTask.health_task_type).all()

    existing_counts = {
        "medication": 0,
        "wound_care": 0,
        "health_check": 0,
        "rehab_exercise": 0,
        "total": 0
    }

    for task_type, count in existing_tasks:
        if task_type == HealthTaskType.MEDICATION:
            existing_counts["medication"] = count
        elif task_type == HealthTaskType.WOUND_CARE:
            existing_counts["wound_care"] = count
        elif task_type == HealthTaskType.HEALTH_CHECK:
            existing_counts["health_check"] = count
        elif task_type == HealthTaskType.REHAB_EXERCISE:
            existing_counts["rehab_exercise"] = count
        existing_counts["total"] += count

    return {
        "target_date": target_date.isoformat(),
        "existing_tasks": existing_counts,
        "already_generated": existing_counts["total"] > 0,
        "message": f"Health tasks for {target_date} {'already exist' if existing_counts['total'] > 0 else 'have not been generated yet'}."
    }


@router.post("/scheduler/generate/{target_date}")
def generate_health_tasks(
    target_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually generate health tasks for a given date (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manually generate health tasks"
        )

    try:
        system_user_id = scheduler_service.get_system_user_id(db)
        generator = HealthTaskGenerator(db, system_user_id)

        result = generator.generate_all_for_date(target_date)

        return {
            "success": True,
            "target_date": target_date.isoformat(),
            "tasks_generated": result,
            "message": f"Generated {result['total']} health tasks for {target_date}"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate health tasks: {str(e)}"
        )


@router.post("/scheduler/rollover")
def run_task_rollover(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually run task rollover - move past incomplete tasks to backlog (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can run task rollover"
        )

    try:
        today = date.today()

        # Find incomplete tasks scheduled for past dates
        past_tasks = db.query(YardTask).filter(
            YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
            YardTask.scheduled_date < today,
            YardTask.scheduled_date.isnot(None)
        ).all()

        count = 0
        for task in past_tasks:
            task.scheduled_date = None
            task.assignment_type = AssignmentType.BACKLOG
            task.assigned_to_id = None
            task.is_maintenance_day_task = False
            count += 1

        db.commit()

        return {
            "success": True,
            "tasks_moved": count,
            "message": f"Moved {count} incomplete tasks to backlog"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run task rollover: {str(e)}"
        )


@router.get("/scheduler/maintenance-days")
def get_upcoming_maintenance_days(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get upcoming maintenance shifts for task scheduling (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view maintenance days"
        )

    today = date.today()

    # Find upcoming shifts with MAINTENANCE role
    maintenance_shifts = db.query(Shift).filter(
        Shift.role == ShiftRole.MAINTENANCE,
        Shift.date >= today
    ).order_by(Shift.date.asc()).limit(10).all()

    return {
        "maintenance_days": [
            {
                "date": shift.date.isoformat(),
                "staff_id": shift.staff_id,
                "staff_name": shift.staff.name if shift.staff else None,
                "shift_type": shift.shift_type.value,
                "notes": shift.notes
            }
            for shift in maintenance_shifts
        ],
        "next_maintenance_day": maintenance_shifts[0].date.isoformat() if maintenance_shifts else None
    }


@router.get("/scheduler/staff-on-rota/{target_date}")
def get_staff_on_rota(
    target_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of staff members who are on rota for a specific date (admin/staff only).

    Used for task assignment to show only relevant staff options.
    """
    from app.utils.auth import has_staff_access
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required"
        )

    # Find all shifts for the target date
    shifts = db.query(Shift).filter(
        Shift.date == target_date
    ).all()

    # Get unique staff members from shifts
    staff_on_rota = []
    seen_ids = set()
    for shift in shifts:
        if shift.staff_id not in seen_ids and shift.staff:
            seen_ids.add(shift.staff_id)
            staff_on_rota.append({
                "id": shift.staff.id,
                "name": shift.staff.name,
                "role": shift.staff.role.value if shift.staff.role else None,
                "shift_type": shift.shift_type.value,
                "shift_role": shift.role.value if shift.role else None
            })

    return {
        "date": target_date.isoformat(),
        "staff_on_rota": staff_on_rota,
        "count": len(staff_on_rota)
    }


@router.post("/scheduler/reschedule")
def reschedule_scheduler_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reschedule all background jobs with current settings (admin only).

    Call this after updating scheduler time settings to apply changes without restart.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can reschedule jobs"
        )

    success = scheduler_service.reschedule_jobs()

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reschedule jobs. Scheduler may not be running."
        )

    # Get updated schedule info
    settings = get_or_create_settings(db)
    sched = scheduler_service._get_scheduler()

    jobs = []
    if sched and sched.running:
        for job in sched.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "schedule": _get_readable_schedule(job.id, settings),
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None
            })

    return {
        "success": True,
        "message": "Scheduler jobs rescheduled successfully",
        "jobs": jobs
    }


# ============== SSL/Domain Configuration ==============

def _get_certificate_info(domain: str) -> CertificateInfo:
    """Check SSL certificate for a domain."""
    import ssl
    import socket
    from datetime import datetime, timezone

    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()

                # Parse certificate dates
                not_before = datetime.strptime(cert['notBefore'], '%b %d %H:%M:%S %Y %Z')
                not_after = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')

                # Calculate days until expiry
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                days_until_expiry = (not_after - now).days

                # Get issuer
                issuer = dict(x[0] for x in cert.get('issuer', []))
                issuer_name = issuer.get('organizationName', issuer.get('commonName', 'Unknown'))

                return CertificateInfo(
                    domain=domain,
                    issuer=issuer_name,
                    valid_from=not_before,
                    valid_until=not_after,
                    days_until_expiry=days_until_expiry,
                    is_valid=days_until_expiry > 0
                )
    except socket.timeout:
        return CertificateInfo(domain=domain, error="Connection timed out")
    except socket.gaierror:
        return CertificateInfo(domain=domain, error="Domain not found")
    except ssl.SSLError as e:
        return CertificateInfo(domain=domain, error=f"SSL error: {str(e)}")
    except Exception as e:
        return CertificateInfo(domain=domain, error=str(e))


def _generate_traefik_config(settings: SiteSettings) -> str:
    """Generate Traefik docker-compose configuration snippet."""
    if not settings.ssl_domain or not settings.ssl_acme_email:
        return "# SSL not configured - domain and ACME email required"

    # Generate htpasswd hash if dashboard credentials are set
    dashboard_labels = ""
    if settings.ssl_traefik_dashboard_enabled and settings.ssl_traefik_dashboard_user:
        dashboard_labels = f'''
      # Traefik Dashboard
      - "traefik.http.routers.dashboard.rule=Host(`traefik.{settings.ssl_domain}`)"
      - "traefik.http.routers.dashboard.entrypoints=websecure"
      - "traefik.http.routers.dashboard.tls.certresolver=letsencrypt"
      - "traefik.http.routers.dashboard.service=api@internal"
      - "traefik.http.routers.dashboard.middlewares=auth"
      - "traefik.http.middlewares.auth.basicauth.users=${{TRAEFIK_AUTH}}"'''

    config = f'''# Generated Traefik Configuration for {settings.ssl_domain}
# Add these environment variables to your .env file:
# DOMAIN={settings.ssl_domain}
# ACME_EMAIL={settings.ssl_acme_email}
{"# TRAEFIK_AUTH=<htpasswd hash>  # Generate with: htpasswd -nb user password" if settings.ssl_traefik_dashboard_enabled else ""}

version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    restart: unless-stopped
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
      - "--certificatesresolvers.letsencrypt.acme.email={settings.ssl_acme_email}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    networks:
      - evm-network
    labels:
      - "traefik.enable=true"{dashboard_labels}

  backend:
    # ... your backend service ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`{settings.ssl_domain}`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=8000"

  frontend:
    # ... your frontend service ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`{settings.ssl_domain}`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"

volumes:
  letsencrypt:

networks:
  evm-network:
    driver: bridge
'''
    return config


@router.get("/ssl", response_model=SSLStatusResponse)
def get_ssl_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get SSL configuration and certificate status (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view SSL settings"
        )

    settings = get_or_create_settings(db)

    # Build settings response
    ssl_settings = SSLSettingsResponse(
        ssl_domain=settings.ssl_domain,
        ssl_acme_email=settings.ssl_acme_email,
        ssl_enabled=settings.ssl_enabled or False,
        ssl_traefik_dashboard_enabled=settings.ssl_traefik_dashboard_enabled or False,
        ssl_traefik_dashboard_user=settings.ssl_traefik_dashboard_user,
        has_dashboard_password=bool(settings.ssl_traefik_dashboard_password_hash)
    )

    # Check certificate if domain is configured
    certificate = None
    if settings.ssl_domain and settings.ssl_enabled:
        certificate = _get_certificate_info(settings.ssl_domain)

    # Generate Traefik config
    traefik_config = _generate_traefik_config(settings)

    return SSLStatusResponse(
        settings=ssl_settings,
        certificate=certificate,
        traefik_config=traefik_config
    )


@router.put("/ssl", response_model=SSLSettingsResponse)
def update_ssl_settings(
    ssl_data: SSLSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update SSL configuration (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update SSL settings"
        )

    settings = get_or_create_settings(db)

    update_data = ssl_data.model_dump(exclude_unset=True)

    # Handle password hashing
    if 'ssl_traefik_dashboard_password' in update_data:
        password = update_data.pop('ssl_traefik_dashboard_password')
        if password:
            # Generate htpasswd-compatible hash
            import hashlib
            import base64
            import os
            salt = os.urandom(8)
            hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
            settings.ssl_traefik_dashboard_password_hash = base64.b64encode(salt + hash_bytes).decode()

    for field, value in update_data.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)

    return SSLSettingsResponse(
        ssl_domain=settings.ssl_domain,
        ssl_acme_email=settings.ssl_acme_email,
        ssl_enabled=settings.ssl_enabled or False,
        ssl_traefik_dashboard_enabled=settings.ssl_traefik_dashboard_enabled or False,
        ssl_traefik_dashboard_user=settings.ssl_traefik_dashboard_user,
        has_dashboard_password=bool(settings.ssl_traefik_dashboard_password_hash)
    )


@router.get("/ssl/check-certificate")
def check_certificate(
    domain: str,
    current_user: User = Depends(get_current_user)
):
    """Check SSL certificate for any domain (admin only).

    Useful for verifying certificate status before or after configuration.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can check certificates"
        )

    return _get_certificate_info(domain)
