"""Backup and restore API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
import os
import json

from app.database import get_db
from app.models import User, UserRole, Backup, BackupSchedule
from app.schemas.backup import (
    BackupCreate, BackupResponse, BackupListResponse,
    BackupScheduleUpdate, BackupScheduleResponse,
    BackupValidationResult,
)
from app.utils.auth import get_current_user
from app.utils.backup import (
    export_database, save_backup_file, load_backup_file,
    validate_backup, delete_backup_file, generate_backup_filename,
    get_backup_file_size, BACKUP_DIR, ensure_backup_dir, import_database,
)

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
        counts = import_database(db, data, clear_first=clear_first, log=log_message)
    except Exception as e:
        db.rollback()
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
