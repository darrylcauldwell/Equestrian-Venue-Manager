"""add_risk_assessments

Revision ID: 075212831772
Revises: 7dbf7c8fda00
Create Date: 2025-12-30 19:40:18.169893

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '075212831772'
down_revision: Union[str, None] = '7dbf7c8fda00'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create risk_assessments table (enum types created automatically by SQLAlchemy)
    op.create_table('risk_assessments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('category', sa.Enum('general_workplace', 'horse_handling', 'yard_environment', 'fire_emergency', 'biosecurity', 'first_aid', 'ppe_manual_handling', 'other', name='riskassessmentcategory'), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('review_period_months', sa.Integer(), nullable=False, server_default='12'),
        sa.Column('required_for_induction', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('applies_to_roles', sa.Text(), nullable=True),
        sa.Column('last_reviewed_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('last_reviewed_by_id', sa.Integer(), nullable=True),
        sa.Column('next_review_due', sa.DateTime(), nullable=True),
        sa.Column('needs_review', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['last_reviewed_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_risk_assessments_id'), 'risk_assessments', ['id'], unique=False)
    op.create_index('ix_risk_assessments_category', 'risk_assessments', ['category'], unique=False)

    # Create risk_assessment_reviews table (admin review history)
    op.create_table('risk_assessment_reviews',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('risk_assessment_id', sa.Integer(), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('reviewed_by_id', sa.Integer(), nullable=False),
        sa.Column('trigger', sa.Enum('scheduled', 'incident', 'change', 'new_hazard', 'legislation', 'initial', 'other', name='reviewtrigger'), nullable=False),
        sa.Column('trigger_details', sa.Text(), nullable=True),
        sa.Column('version_before', sa.Integer(), nullable=False),
        sa.Column('version_after', sa.Integer(), nullable=False),
        sa.Column('changes_made', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('changes_summary', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['reviewed_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['risk_assessment_id'], ['risk_assessments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_risk_assessment_reviews_id'), 'risk_assessment_reviews', ['id'], unique=False)
    op.create_index('ix_risk_assessment_reviews_assessment_id', 'risk_assessment_reviews', ['risk_assessment_id'], unique=False)

    # Create risk_assessment_acknowledgements table (staff reading records)
    op.create_table('risk_assessment_acknowledgements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('risk_assessment_id', sa.Integer(), nullable=False),
        sa.Column('assessment_version', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['risk_assessment_id'], ['risk_assessments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_risk_assessment_acknowledgements_id'), 'risk_assessment_acknowledgements', ['id'], unique=False)
    op.create_index('ix_risk_assessment_acks_user_id', 'risk_assessment_acknowledgements', ['user_id'], unique=False)
    op.create_index('ix_risk_assessment_acks_assessment_id', 'risk_assessment_acknowledgements', ['risk_assessment_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_risk_assessment_acks_assessment_id', table_name='risk_assessment_acknowledgements')
    op.drop_index('ix_risk_assessment_acks_user_id', table_name='risk_assessment_acknowledgements')
    op.drop_index(op.f('ix_risk_assessment_acknowledgements_id'), table_name='risk_assessment_acknowledgements')
    op.drop_table('risk_assessment_acknowledgements')

    op.drop_index('ix_risk_assessment_reviews_assessment_id', table_name='risk_assessment_reviews')
    op.drop_index(op.f('ix_risk_assessment_reviews_id'), table_name='risk_assessment_reviews')
    op.drop_table('risk_assessment_reviews')

    op.drop_index('ix_risk_assessments_category', table_name='risk_assessments')
    op.drop_index(op.f('ix_risk_assessments_id'), table_name='risk_assessments')
    op.drop_table('risk_assessments')

    op.execute('DROP TYPE reviewtrigger')
    op.execute('DROP TYPE riskassessmentcategory')
