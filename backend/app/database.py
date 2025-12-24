from sqlalchemy import create_engine, Column, Enum
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def EnumColumn(enum_class, **kwargs):
    """
    Create an Enum column that uses enum values (not names) for database storage.

    This ensures PostgreSQL enums work correctly with Python enums where:
    - enum.name = "UPPERCASE_NAME"
    - enum.value = "lowercase_value"

    The database stores lowercase values to match migrations.

    Usage:
        contact_type = EnumColumn(ContactType, nullable=False)
        status = EnumColumn(StatusEnum, default=StatusEnum.PENDING)
    """
    return Column(
        Enum(enum_class, values_callable=lambda x: [e.value for e in x]),
        **kwargs
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
