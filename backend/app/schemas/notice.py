from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.models.notice import NoticeCategory, NoticePriority


class NoticeCreate(BaseModel):
    title: str
    content: str
    category: NoticeCategory = NoticeCategory.GENERAL
    priority: NoticePriority = NoticePriority.NORMAL
    is_pinned: bool = False
    expires_at: Optional[datetime] = None


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[NoticeCategory] = None
    priority: Optional[NoticePriority] = None
    is_pinned: Optional[bool] = None
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None


class NoticeResponse(BaseModel):
    id: int
    title: str
    content: str
    category: NoticeCategory
    priority: NoticePriority
    is_pinned: bool
    is_active: bool
    expires_at: Optional[datetime]
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class NoticeListResponse(BaseModel):
    pinned: List[NoticeResponse]
    notices: List[NoticeResponse]
    total: int

    class Config:
        from_attributes = True
