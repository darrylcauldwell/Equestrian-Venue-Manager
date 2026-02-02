from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


class PayslipResponse(BaseModel):
    """Response for a single payslip record."""
    id: int
    staff_id: int
    document_type: str
    year: int
    month: int
    pdf_filename: str
    original_filename: Optional[str] = None
    notes: Optional[str] = None
    uploaded_by_id: int
    created_at: datetime
    staff_name: Optional[str] = None
    uploaded_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PayslipListResponse(BaseModel):
    """List of payslips."""
    payslips: List[PayslipResponse]
    total: int
