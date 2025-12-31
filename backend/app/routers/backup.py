"""Backup and restore API endpoints.

Two types of backups:
1. Database Backup (pg_dump) - Full PostgreSQL dump for disaster recovery
2. Data Export (JSON) - Human-readable export for portability/seeding
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
import os
import json
import subprocess
import traceback
import logging

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models import User, UserRole, Backup, BackupSchedule
from app.schemas.backup import (
    BackupCreate, BackupResponse, BackupListResponse,
    BackupScheduleUpdate, BackupScheduleResponse,
    BackupValidationResult,
    DatabaseBackupResponse, DatabaseBackupListResponse,
)
from app.utils.auth import get_current_user
from app.utils.backup import (
    export_database, save_backup_file, load_backup_file,
    validate_backup, delete_backup_file, generate_backup_filename,
    get_backup_file_size, BACKUP_DIR, ensure_backup_dir, import_database,
)

# Directory for pg_dump backups
DB_BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "db_backups")

router = APIRouter()


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role for access."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.post("/export", response_model=BackupResponse)
def create_backup(
    data: BackupCreate = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new database backup."""
    # Export the database
    backup_data, entity_counts = export_database(db)

    # Add metadata
    backup_data["_metadata"] = {
        "version": "1.0",
        "exported_at": datetime.utcnow().isoformat(),
        "exported_by": current_user.name,
    }

    # Generate filename and save
    filename = generate_backup_filename()
    save_backup_file(backup_data, filename)
    file_size = get_backup_file_size(filename)

    # Create database record
    backup = Backup(
        filename=filename,
        backup_date=datetime.utcnow(),
        file_size=file_size,
        entity_counts=entity_counts,
        storage_location="local",
        notes=data.notes if data else None,
        created_by_id=current_user.id,
    )
    db.add(backup)
    db.commit()
    db.refresh(backup)

    return BackupResponse(
        id=backup.id,
        filename=backup.filename,
        backup_date=backup.backup_date,
        file_size=backup.file_size,
        entity_counts=backup.entity_counts,
        storage_location=backup.storage_location,
        notes=backup.notes,
        created_by_id=backup.created_by_id,
        created_by_name=current_user.name,
    )


@router.get("/list", response_model=BackupListResponse)
def list_backups(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all database backups."""
    backups = db.query(Backup).order_by(Backup.backup_date.desc()).all()

    backup_responses = []
    for backup in backups:
        created_by_name = None
        if backup.created_by:
            created_by_name = backup.created_by.name

        backup_responses.append(BackupResponse(
            id=backup.id,
            filename=backup.filename,
            backup_date=backup.backup_date,
            file_size=backup.file_size,
            entity_counts=backup.entity_counts,
            storage_location=backup.storage_location,
            s3_url=backup.s3_url,
            notes=backup.notes,
            created_by_id=backup.created_by_id,
            created_by_name=created_by_name,
        ))

    return BackupListResponse(backups=backup_responses, total=len(backup_responses))


@router.get("/download/{backup_id}")
def download_backup(
    backup_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Download a backup file."""
    backup = db.query(Backup).filter(Backup.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    filepath = os.path.join(BACKUP_DIR, backup.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Backup file not found on disk")

    return FileResponse(
        filepath,
        media_type="application/json",
        filename=backup.filename,
    )


@router.post("/validate", response_model=BackupValidationResult)
async def validate_backup_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
):
    """Validate an uploaded backup file without importing."""
    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError as e:
        return BackupValidationResult(
            is_valid=False,
            errors=[f"Invalid JSON: {str(e)}"],
        )
    except Exception as e:
        return BackupValidationResult(
            is_valid=False,
            errors=[f"Error reading file: {str(e)}"],
        )

    is_valid, errors, warnings = validate_backup(data)

    # Count entities if valid
    entity_counts = None
    if is_valid:
        entity_counts = {}
        for key, value in data.items():
            if key != "_metadata" and isinstance(value, list):
                entity_counts[key] = len(value)
            elif key != "_metadata" and isinstance(value, dict):
                entity_counts[key] = 1

    return BackupValidationResult(
        is_valid=is_valid,
        entity_counts=entity_counts,
        errors=errors,
        warnings=warnings,
    )


@router.delete("/{backup_id}")
def delete_backup(
    backup_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a backup record and its file."""
    backup = db.query(Backup).filter(Backup.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    # Delete the file
    delete_backup_file(backup.filename)

    # Delete the database record
    db.delete(backup)
    db.commit()

    return {"message": "Backup deleted successfully"}


@router.post("/import")
async def import_backup(
    file: UploadFile = File(...),
    clear_first: bool = False,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Import/restore data from a backup file.

    Supports both backup format (IDs, absolute dates) and seed format
    (name references, relative dates like days_from_now).

    WARNING: If clear_first=True, all existing data will be deleted first!
    """
    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

    # Validate first
    is_valid, errors, warnings = validate_backup(data)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid backup file: {'; '.join(errors)}"
        )

    # Collect import logs
    logs = []

    def log_message(msg: str):
        logs.append(msg)

    try:
        # Skip seed validation since backup format is different from seed format
        # (backup uses IDs and absolute dates, seed uses usernames and relative dates)
        # The backup was already validated above using validate_backup()
        counts = import_database(db, data, clear_first=clear_first, validate=False, log=log_message)
    except Exception as e:
        db.rollback()
        logger.error(f"Import failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

    return {
        "message": "Import completed successfully",
        "entity_counts": counts,
        "warnings": warnings,
        "logs": logs[-20:],  # Last 20 log messages
    }


@router.get("/schedule", response_model=BackupScheduleResponse)
def get_backup_schedule(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get the backup schedule configuration."""
    schedule = db.query(BackupSchedule).first()
    if not schedule:
        # Create default schedule
        schedule = BackupSchedule(
            is_enabled=False,
            frequency="daily",
            retention_days=30,
            s3_enabled=False,
        )
        db.add(schedule)
        db.commit()
        db.refresh(schedule)

    return schedule


@router.put("/schedule", response_model=BackupScheduleResponse)
def update_backup_schedule(
    data: BackupScheduleUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update the backup schedule configuration."""
    schedule = db.query(BackupSchedule).first()
    if not schedule:
        schedule = BackupSchedule()
        db.add(schedule)

    schedule.is_enabled = data.is_enabled
    schedule.frequency = data.frequency
    schedule.retention_days = data.retention_days
    schedule.s3_enabled = data.s3_enabled
    schedule.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(schedule)

    return schedule


# =============================================================================
# DATABASE BACKUP (pg_dump) - For disaster recovery
# =============================================================================

def ensure_db_backup_dir():
    """Ensure the database backups directory exists."""
    if not os.path.exists(DB_BACKUP_DIR):
        os.makedirs(DB_BACKUP_DIR)


def get_db_connection_info():
    """Get database connection info from environment."""
    return {
        "host": os.environ.get("POSTGRES_HOST", "db"),
        "port": os.environ.get("POSTGRES_PORT", "5432"),
        "user": os.environ.get("POSTGRES_USER", "evm"),
        "password": os.environ.get("POSTGRES_PASSWORD", "evm_password"),
        "database": os.environ.get("POSTGRES_DB", "evm_db"),
    }


@router.post("/database/create", response_model=DatabaseBackupResponse)
def create_database_backup(
    current_user: User = Depends(require_admin),
):
    """
    Create a full database backup using pg_dump.

    This creates a complete PostgreSQL dump that can be used for disaster recovery.
    The backup includes all data, schema, sequences, and constraints.
    """
    ensure_db_backup_dir()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"db_backup_{timestamp}.sql"
    filepath = os.path.join(DB_BACKUP_DIR, filename)

    db_info = get_db_connection_info()

    # Set PGPASSWORD environment variable for pg_dump
    env = os.environ.copy()
    env["PGPASSWORD"] = db_info["password"]

    try:
        # Run pg_dump
        result = subprocess.run(
            [
                "pg_dump",
                "-h", db_info["host"],
                "-p", db_info["port"],
                "-U", db_info["user"],
                "-d", db_info["database"],
                "-f", filepath,
                "--no-owner",  # Don't output ownership commands
                "--no-acl",    # Don't output access privilege commands
            ],
            env=env,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"pg_dump failed: {result.stderr}"
            )

        file_size = os.path.getsize(filepath)

        return DatabaseBackupResponse(
            filename=filename,
            created_at=datetime.now().isoformat(),
            file_size=file_size,
            created_by=current_user.name,
        )

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Backup timed out")
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="pg_dump not found. Ensure PostgreSQL client tools are installed."
        )


@router.get("/database/list", response_model=DatabaseBackupListResponse)
def list_database_backups(
    current_user: User = Depends(require_admin),
):
    """List all database backups (pg_dump files)."""
    ensure_db_backup_dir()

    backups = []
    for filename in os.listdir(DB_BACKUP_DIR):
        if filename.endswith('.sql'):
            filepath = os.path.join(DB_BACKUP_DIR, filename)
            stat = os.stat(filepath)
            backups.append(DatabaseBackupResponse(
                filename=filename,
                created_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                file_size=stat.st_size,
            ))

    # Sort by creation date, newest first
    backups.sort(key=lambda x: x.created_at, reverse=True)

    return DatabaseBackupListResponse(backups=backups, total=len(backups))


@router.get("/database/download/{filename}")
def download_database_backup(
    filename: str,
    current_user: User = Depends(require_admin),
):
    """Download a database backup file."""
    # Security: ensure filename doesn't contain path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    filepath = os.path.join(DB_BACKUP_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Backup file not found")

    return FileResponse(
        filepath,
        media_type="application/sql",
        filename=filename,
    )


@router.delete("/database/{filename}")
def delete_database_backup(
    filename: str,
    current_user: User = Depends(require_admin),
):
    """Delete a database backup file."""
    # Security: ensure filename doesn't contain path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    filepath = os.path.join(DB_BACKUP_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Backup file not found")

    os.remove(filepath)
    return {"message": "Database backup deleted successfully"}
