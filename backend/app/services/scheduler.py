"""
Task Scheduler Service

Manages scheduled jobs including:
- Midnight health task generation (medications, wound care, health checks, rehab)
- Task rollover (move past incomplete tasks to backlog)
- Monthly livery billing (1st of each month)
- Automated database backups (configurable frequency)
- Backup retention cleanup
"""

import logging
from datetime import date, datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.services.health_task_generator import HealthTaskGenerator
from app.services.billing_service import BillingService
from app.models.user import User
from app.models.task import YardTask, TaskStatus, AssignmentType
from app.models.backup import Backup, BackupSchedule

logger = logging.getLogger(__name__)

# Global scheduler instance - will be recreated if needed
scheduler: AsyncIOScheduler = None


def _get_scheduler() -> AsyncIOScheduler:
    """Get or create the scheduler instance."""
    global scheduler
    if scheduler is None:
        scheduler = AsyncIOScheduler()
    return scheduler


def get_system_user_id(db: Session) -> int:
    """Get system/admin user ID for auto-generated tasks."""
    # Try to find an admin user
    admin = db.query(User).filter(
        User.role == "admin",
        User.is_active == True
    ).first()

    if admin:
        return admin.id

    # Fallback to first active user
    user = db.query(User).filter(User.is_active == True).first()
    return user.id if user else 1


def rollover_incomplete_tasks():
    """
    Job function: Move past incomplete tasks to backlog.

    This runs at 00:05 each day to:
    - Find tasks scheduled for past dates that are still OPEN or IN_PROGRESS
    - Move them to backlog for rescheduling
    - Clear their scheduled_date and assignment
    """
    logger.info("Starting task rollover...")

    db = SessionLocal()
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
        logger.info(f"Task rollover complete: {count} tasks moved to backlog")

    except Exception as e:
        logger.error(f"Error during task rollover: {e}")
        db.rollback()
    finally:
        db.close()


def generate_daily_health_tasks():
    """
    Job function: Generate all health tasks for today.

    This runs at 00:01 each day to create:
    - Medication administration tasks
    - Wound care tasks
    - Daily health check tasks
    - Rehab exercise tasks
    """
    logger.info("Starting daily health task generation...")

    db = SessionLocal()
    try:
        system_user_id = get_system_user_id(db)
        generator = HealthTaskGenerator(db, system_user_id)

        today = date.today()
        result = generator.generate_all_for_date(today)

        logger.info(
            f"Daily health task generation complete: "
            f"{result['medication']} medication, "
            f"{result['wound_care']} wound care, "
            f"{result['health_check']} health check, "
            f"{result['rehab_exercise']} rehab exercise tasks created. "
            f"Total: {result['total']}"
        )

    except Exception as e:
        logger.error(f"Error generating daily health tasks: {e}")
        db.rollback()
    finally:
        db.close()


def _get_schedule_settings():
    """Get scheduler settings from database, with defaults."""
    from app.models.settings import SiteSettings
    db = SessionLocal()
    try:
        settings = db.query(SiteSettings).first()
        if settings:
            return {
                "health_tasks_hour": settings.scheduler_health_tasks_hour or 0,
                "health_tasks_minute": settings.scheduler_health_tasks_minute or 1,
                "rollover_hour": settings.scheduler_rollover_hour or 0,
                "rollover_minute": settings.scheduler_rollover_minute or 5,
                "billing_day": settings.scheduler_billing_day or 1,
                "billing_hour": settings.scheduler_billing_hour or 6,
                "billing_minute": settings.scheduler_billing_minute or 0,
                "backup_hour": settings.scheduler_backup_hour or 2,
                "backup_minute": settings.scheduler_backup_minute or 0,
                "cleanup_hour": settings.scheduler_cleanup_hour or 2,
                "cleanup_minute": settings.scheduler_cleanup_minute or 30,
            }
    finally:
        db.close()

    # Return defaults if no settings found
    return {
        "health_tasks_hour": 0, "health_tasks_minute": 1,
        "rollover_hour": 0, "rollover_minute": 5,
        "billing_day": 1, "billing_hour": 6, "billing_minute": 0,
        "backup_hour": 2, "backup_minute": 0,
        "cleanup_hour": 2, "cleanup_minute": 30,
    }


def start_scheduler():
    """Start the scheduler with all configured jobs."""
    global scheduler
    sched = _get_scheduler()

    if sched.running:
        logger.info("Scheduler already running")
        return

    try:
        # Get configured schedule times from settings
        times = _get_schedule_settings()

        # Misfire handling: allow jobs to run if missed within grace period
        # coalesce=True means if multiple runs were missed, only run once
        daily_grace_time = 23 * 3600  # 23 hours for daily jobs
        monthly_grace_time = 7 * 24 * 3600  # 7 days for monthly jobs

        # Add health task generation job
        sched.add_job(
            generate_daily_health_tasks,
            trigger=CronTrigger(hour=times["health_tasks_hour"], minute=times["health_tasks_minute"]),
            id="daily_health_tasks",
            name="Generate daily health tasks",
            replace_existing=True,
            misfire_grace_time=daily_grace_time,
            coalesce=True
        )

        # Add task rollover job
        sched.add_job(
            rollover_incomplete_tasks,
            trigger=CronTrigger(hour=times["rollover_hour"], minute=times["rollover_minute"]),
            id="task_rollover",
            name="Rollover incomplete tasks to backlog",
            replace_existing=True,
            misfire_grace_time=daily_grace_time,
            coalesce=True
        )

        # Add monthly billing job
        sched.add_job(
            generate_monthly_billing,
            trigger=CronTrigger(day=times["billing_day"], hour=times["billing_hour"], minute=times["billing_minute"]),
            id="monthly_billing",
            name="Generate monthly livery billing",
            replace_existing=True,
            misfire_grace_time=monthly_grace_time,
            coalesce=True
        )

        # Add automated backup job
        sched.add_job(
            run_automated_backup,
            trigger=CronTrigger(hour=times["backup_hour"], minute=times["backup_minute"]),
            id="automated_backup",
            name="Automated database backup",
            replace_existing=True,
            misfire_grace_time=daily_grace_time,
            coalesce=True
        )

        # Add backup cleanup job
        sched.add_job(
            cleanup_old_backups,
            trigger=CronTrigger(hour=times["cleanup_hour"], minute=times["cleanup_minute"]),
            id="backup_cleanup",
            name="Cleanup old backups based on retention",
            replace_existing=True,
            misfire_grace_time=daily_grace_time,
            coalesce=True
        )

        sched.start()
        logger.info(
            f"Scheduler started with: health tasks ({times['health_tasks_hour']:02d}:{times['health_tasks_minute']:02d}), "
            f"rollover ({times['rollover_hour']:02d}:{times['rollover_minute']:02d}), "
            f"billing ({times['billing_day']}st @ {times['billing_hour']:02d}:{times['billing_minute']:02d}), "
            f"backup ({times['backup_hour']:02d}:{times['backup_minute']:02d}), "
            f"cleanup ({times['cleanup_hour']:02d}:{times['cleanup_minute']:02d})"
        )
    except RuntimeError as e:
        # Event loop issues in test environments - recreate scheduler
        if "Event loop is closed" in str(e) or "no running event loop" in str(e):
            logger.debug("Scheduler start failed - recreating scheduler instance")
            scheduler = AsyncIOScheduler()
            start_scheduler()  # Retry with new instance
        else:
            raise


def reschedule_jobs():
    """Reschedule all jobs with current settings. Call after settings are updated."""
    global scheduler
    sched = _get_scheduler()

    if not sched or not sched.running:
        logger.warning("Scheduler not running, cannot reschedule jobs")
        return False

    try:
        times = _get_schedule_settings()

        # Reschedule each job with new times
        sched.reschedule_job(
            "daily_health_tasks",
            trigger=CronTrigger(hour=times["health_tasks_hour"], minute=times["health_tasks_minute"])
        )
        sched.reschedule_job(
            "task_rollover",
            trigger=CronTrigger(hour=times["rollover_hour"], minute=times["rollover_minute"])
        )
        sched.reschedule_job(
            "monthly_billing",
            trigger=CronTrigger(day=times["billing_day"], hour=times["billing_hour"], minute=times["billing_minute"])
        )
        sched.reschedule_job(
            "automated_backup",
            trigger=CronTrigger(hour=times["backup_hour"], minute=times["backup_minute"])
        )
        sched.reschedule_job(
            "backup_cleanup",
            trigger=CronTrigger(hour=times["cleanup_hour"], minute=times["cleanup_minute"])
        )

        logger.info(
            f"Jobs rescheduled: health tasks ({times['health_tasks_hour']:02d}:{times['health_tasks_minute']:02d}), "
            f"rollover ({times['rollover_hour']:02d}:{times['rollover_minute']:02d}), "
            f"billing ({times['billing_day']}st @ {times['billing_hour']:02d}:{times['billing_minute']:02d}), "
            f"backup ({times['backup_hour']:02d}:{times['backup_minute']:02d}), "
            f"cleanup ({times['cleanup_hour']:02d}:{times['cleanup_minute']:02d})"
        )
        return True
    except Exception as e:
        logger.error(f"Error rescheduling jobs: {e}")
        return False


def stop_scheduler():
    """Stop the scheduler gracefully."""
    global scheduler
    sched = _get_scheduler()

    if sched.running:
        try:
            sched.shutdown(wait=False)
            logger.info("Scheduler stopped")
        except RuntimeError as e:
            # Event loop may already be closed in test environments
            if "Event loop is closed" not in str(e):
                raise
            logger.debug("Scheduler shutdown skipped - event loop already closed")

    # Reset scheduler for potential reuse with new event loop
    scheduler = None


def run_health_task_generation_now():
    """
    Manually trigger health task generation.
    Useful for admin actions or testing.
    """
    generate_daily_health_tasks()


def generate_monthly_billing():
    """
    Job function: Generate monthly livery billing.

    This runs on the 1st of each month at 06:00 to create
    ledger entries for all horses with livery packages.
    """
    logger.info("Starting monthly livery billing generation...")

    db = SessionLocal()
    try:
        system_user_id = get_system_user_id(db)
        billing_service = BillingService(db, system_user_id)

        # Bill for the previous month
        today = date.today()
        if today.month == 1:
            billing_year = today.year - 1
            billing_month = 12
        else:
            billing_year = today.year
            billing_month = today.month - 1

        result = billing_service.generate_billing(
            billing_year=billing_year,
            billing_month=billing_month,
            preview_only=False,
            skip_already_billed=True
        )

        logger.info(
            f"Monthly billing complete for {billing_year}-{billing_month:02d}: "
            f"{result.total_owners} owners, "
            f"{result.total_horses} horses, "
            f"Total: £{result.total_amount}, "
            f"{result.ledger_entries_created} ledger entries created"
        )

    except Exception as e:
        logger.error(f"Error generating monthly billing: {e}")
        db.rollback()
    finally:
        db.close()


def run_monthly_billing_now(year: int = None, month: int = None):
    """
    Manually trigger monthly billing.
    Useful for admin actions or testing.

    If year/month not specified, bills for previous month.
    """
    logger.info(f"Manual billing run triggered for {year}-{month if month else 'previous month'}")

    db = SessionLocal()
    try:
        system_user_id = get_system_user_id(db)
        billing_service = BillingService(db, system_user_id)

        # Default to previous month
        if year is None or month is None:
            today = date.today()
            if today.month == 1:
                year = today.year - 1
                month = 12
            else:
                year = today.year
                month = today.month - 1

        result = billing_service.generate_billing(
            billing_year=year,
            billing_month=month,
            preview_only=False,
            skip_already_billed=True
        )

        logger.info(
            f"Manual billing complete: "
            f"{result.ledger_entries_created} entries created, "
            f"Total: £{result.total_amount}"
        )

        return result

    except Exception as e:
        logger.error(f"Error in manual billing: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def run_automated_backup():
    """
    Job function: Create automated database backup.

    This checks if backup schedule is enabled and if it's time to run,
    then creates a backup and updates the schedule timestamps.
    """
    logger.info("Checking automated backup schedule...")

    db = SessionLocal()
    try:
        # Get or create backup schedule
        schedule = db.query(BackupSchedule).first()
        if not schedule:
            logger.debug("No backup schedule configured")
            return

        if not schedule.is_enabled:
            logger.debug("Automated backups are disabled")
            return

        # Check if it's time to run based on frequency
        now = datetime.utcnow()
        should_run = False

        if schedule.last_run is None:
            should_run = True
        else:
            if schedule.frequency == "daily":
                should_run = (now - schedule.last_run) >= timedelta(days=1)
            elif schedule.frequency == "weekly":
                should_run = (now - schedule.last_run) >= timedelta(weeks=1)
            elif schedule.frequency == "monthly":
                should_run = (now - schedule.last_run) >= timedelta(days=30)

        if not should_run:
            logger.debug("Backup not due yet")
            return

        # Import backup utilities
        from app.utils.backup import export_database, save_backup_file, generate_backup_filename

        # Create the backup
        logger.info("Creating automated backup...")
        system_user_id = get_system_user_id(db)

        data, entity_counts = export_database(db)
        filename = generate_backup_filename()
        filepath = save_backup_file(data, filename)

        # Get file size
        import os
        file_size = os.path.getsize(filepath) if os.path.exists(filepath) else 0

        # Record the backup
        backup = Backup(
            filename=filename,
            backup_date=now,
            file_size=file_size,
            entity_counts=entity_counts,
            storage_location="local",
            notes="Automated backup",
            created_by_id=system_user_id
        )
        db.add(backup)

        # Update schedule timestamps
        schedule.last_run = now
        if schedule.frequency == "daily":
            schedule.next_run = now + timedelta(days=1)
        elif schedule.frequency == "weekly":
            schedule.next_run = now + timedelta(weeks=1)
        elif schedule.frequency == "monthly":
            schedule.next_run = now + timedelta(days=30)

        db.commit()
        logger.info(f"Automated backup created: {filename} ({file_size} bytes)")

    except Exception as e:
        logger.error(f"Error creating automated backup: {e}")
        db.rollback()
    finally:
        db.close()


def cleanup_old_backups():
    """
    Job function: Delete backups older than retention period.

    This runs after backup creation to clean up old backups
    based on the configured retention_days setting.
    """
    logger.info("Cleaning up old backups...")

    db = SessionLocal()
    try:
        # Get backup schedule for retention setting
        schedule = db.query(BackupSchedule).first()
        if not schedule:
            logger.debug("No backup schedule configured, skipping cleanup")
            return

        retention_days = schedule.retention_days or 30
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

        # Find old backups
        old_backups = db.query(Backup).filter(
            Backup.backup_date < cutoff_date
        ).all()

        if not old_backups:
            logger.debug("No old backups to clean up")
            return

        # Import delete function
        from app.utils.backup import delete_backup_file

        deleted_count = 0
        for backup in old_backups:
            try:
                # Delete the file
                delete_backup_file(backup.filename)
                # Delete the record
                db.delete(backup)
                deleted_count += 1
            except Exception as e:
                logger.warning(f"Failed to delete backup {backup.filename}: {e}")

        db.commit()
        logger.info(f"Cleanup complete: {deleted_count} old backups deleted (retention: {retention_days} days)")

    except Exception as e:
        logger.error(f"Error cleaning up old backups: {e}")
        db.rollback()
    finally:
        db.close()
