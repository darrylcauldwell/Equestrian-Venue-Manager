from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.notice import Notice, NoticeCategory
from app.models.user import User
from app.schemas.notice import (
    NoticeCreate,
    NoticeUpdate,
    NoticeResponse,
    NoticeListResponse,
)
from app.utils.auth import get_current_user, get_current_user_optional
from app.utils.crud import CRUDFactory, require_admin

router = APIRouter()


def enrich_notice(notice: Notice) -> NoticeResponse:
    """Add created_by_name to notice."""
    response = NoticeResponse.model_validate(notice)
    if notice.created_by:
        response.created_by_name = notice.created_by.name
    return response


# CRUD factory for notices
crud = CRUDFactory(model=Notice, name="notice", response_transform=enrich_notice)


@router.get("/", response_model=NoticeListResponse)
def list_notices(
    category: Optional[NoticeCategory] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """List all active notices. Pinned notices are returned separately."""
    now = datetime.utcnow()

    # Base query for active, non-expired notices
    base_query = db.query(Notice).filter(
        Notice.is_active == True,
        or_(Notice.expires_at == None, Notice.expires_at > now)
    )

    if category:
        base_query = base_query.filter(Notice.category == category)

    # Get pinned notices
    pinned = base_query.filter(Notice.is_pinned == True).order_by(
        Notice.priority.desc(),
        Notice.created_at.desc()
    ).all()

    # Get regular notices
    regular_query = base_query.filter(Notice.is_pinned == False)
    total = regular_query.count()
    notices = regular_query.order_by(
        Notice.priority.desc(),
        Notice.created_at.desc()
    ).offset(offset).limit(limit).all()

    return NoticeListResponse(
        pinned=[enrich_notice(n) for n in pinned],
        notices=[enrich_notice(n) for n in notices],
        total=total + len(pinned)
    )


@router.get("/{notice_id}", response_model=NoticeResponse)
def get_notice(
    notice_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific notice."""
    return crud.get(db, notice_id)


@router.post("/", response_model=NoticeResponse, status_code=status.HTTP_201_CREATED)
def create_notice(
    data: NoticeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new notice (admin only)."""
    return crud.create_admin_only(
        db, data, current_user,
        extra_fields={"created_by_id": current_user.id}
    )


@router.put("/{notice_id}", response_model=NoticeResponse)
def update_notice(
    notice_id: int,
    data: NoticeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a notice (admin only, or creator)."""
    return crud.update_with_owner_check(
        db, notice_id, data, current_user,
        owner_field="created_by_id",
        allow_admin=True
    )


@router.delete("/{notice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notice(
    notice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a notice (admin only, or creator)."""
    crud.delete_with_owner_check(db, notice_id, current_user, owner_field="created_by_id")


@router.get("/admin/all", response_model=List[NoticeResponse])
def list_all_notices_admin(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all notices including inactive ones (admin only)."""
    require_admin(current_user, "view all notices")

    query = db.query(Notice)
    if not include_inactive:
        query = query.filter(Notice.is_active == True)

    notices = query.order_by(Notice.created_at.desc()).all()
    return [enrich_notice(n) for n in notices]
