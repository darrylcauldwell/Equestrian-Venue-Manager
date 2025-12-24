import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import SiteSettings
from app.models.user import User, UserRole
from app.utils.auth import get_current_user

router = APIRouter()

# Configure upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def ensure_upload_dir():
    """Ensure the upload directory exists."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def validate_image(file: UploadFile) -> None:
    """Validate uploaded file is an allowed image type."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided"
        )

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )


def save_upload(file: UploadFile, prefix: str) -> str:
    """Save uploaded file and return the filename."""
    ensure_upload_dir()

    ext = os.path.splitext(file.filename)[1].lower()
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Read and save file
    contents = file.file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // 1024 // 1024}MB"
        )

    with open(filepath, "wb") as f:
        f.write(contents)

    return filename


def delete_old_upload(filename: str) -> None:
    """Delete an old uploaded file if it exists."""
    if filename:
        filepath = os.path.join(UPLOAD_DIR, os.path.basename(filename))
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass  # Ignore errors when deleting old files


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a new logo image (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can upload images"
        )

    validate_image(file)

    # Get or create settings
    settings = db.query(SiteSettings).first()
    if not settings:
        settings = SiteSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Delete old logo if exists
    if settings.logo_url:
        delete_old_upload(settings.logo_url)

    # Save new logo
    filename = save_upload(file, "logo")
    settings.logo_url = filename
    db.commit()

    return {"filename": filename, "url": f"/api/uploads/files/{filename}"}


@router.get("/files/{filename}")
async def get_uploaded_file(filename: str):
    """Serve an uploaded file (public)."""
    # Sanitize filename to prevent directory traversal
    safe_filename = os.path.basename(filename)
    filepath = os.path.join(UPLOAD_DIR, safe_filename)

    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    return FileResponse(filepath)


@router.delete("/logo")
async def delete_logo(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete the current logo image (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can delete images"
        )

    settings = db.query(SiteSettings).first()
    if settings and settings.logo_url:
        delete_old_upload(settings.logo_url)
        settings.logo_url = None
        db.commit()

    return {"message": "Logo deleted"}


@router.post("/arena")
async def upload_arena_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an arena image (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can upload images"
        )

    validate_image(file)
    filename = save_upload(file, "arena")

    return {"filename": filename, "url": f"/api/uploads/files/{filename}"}
