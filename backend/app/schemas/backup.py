from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any


# Backup schemas
class BackupBase(BaseModel):
    notes: Optional[str] = None


class BackupCreate(BackupBase):
    pass


class BackupResponse(BaseModel):
    id: int
    filename: str
    backup_date: datetime
    file_size: Optional[int] = None
    entity_counts: Optional[Dict[str, int]] = None
    storage_location: str
    s3_url: Optional[str] = None
    notes: Optional[str] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class BackupListResponse(BaseModel):
    backups: list[BackupResponse]
    total: int


# Backup Schedule schemas
class BackupScheduleBase(BaseModel):
    is_enabled: bool = False
    frequency: str = "daily"  # daily, weekly, monthly
    retention_days: int = 30
    s3_enabled: bool = False


class BackupScheduleUpdate(BackupScheduleBase):
    pass


class BackupScheduleResponse(BackupScheduleBase):
    id: int
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Validation schemas
class BackupValidationResult(BaseModel):
    is_valid: bool
    entity_counts: Optional[Dict[str, int]] = None
    errors: list[str] = []
    warnings: list[str] = []


# Export data structure
class BackupData(BaseModel):
    """Structure of exported backup data."""
    version: str = "1.0"
    exported_at: datetime
    entity_counts: Dict[str, int]
    data: Dict[str, Any]
