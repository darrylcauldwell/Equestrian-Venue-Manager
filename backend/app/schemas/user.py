from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import UserRole
from app.utils.validators import validate_uk_phone


class UserCreate(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    name: str
    phone: Optional[str] = None
    password: str

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_uk_phone(v)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    address_street: Optional[str] = None
    address_town: Optional[str] = None
    address_county: Optional[str] = None
    address_postcode: Optional[str] = None
    password: Optional[str] = None

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_uk_phone(v)


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    name: str
    phone: Optional[str] = None
    address_street: Optional[str] = None
    address_town: Optional[str] = None
    address_county: Optional[str] = None
    address_postcode: Optional[str] = None
    role: UserRole
    is_yard_staff: bool = False
    must_change_password: bool = False
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class AdminUserCreate(BaseModel):
    """Schema for admin creating new users (staff or livery)"""
    username: str
    email: Optional[EmailStr] = None
    name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.LIVERY

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_uk_phone(v)


class AdminUserUpdate(BaseModel):
    """Schema for admin updating users"""
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    address_street: Optional[str] = None
    address_town: Optional[str] = None
    address_county: Optional[str] = None
    address_postcode: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    is_yard_staff: Optional[bool] = None

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_uk_phone(v)


class AdminUserCreateResponse(BaseModel):
    """Response including temporary password"""
    user: "UserResponse"
    temporary_password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool = False
    user_role: UserRole = UserRole.PUBLIC


class TokenData(BaseModel):
    user_id: Optional[int] = None
    token_type: Optional[str] = None
