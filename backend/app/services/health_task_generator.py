"""
Health Task Generator Service

Generates YardTask entries from health data sources:
- Medication tasks from FeedAddition
- Wound care tasks from active WoundCareLog entries
- Daily health check tasks for each livery horse
- Rehab exercise tasks from active RehabProgram/RehabTask

This service is called:
1. Daily at midnight via scheduler (auto-generation)
2. On-demand by admin via API endpoint
"""

from datetime import date, datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.task import (
    YardTask, TaskCategory, TaskPriority, TaskStatus,
    AssignmentType, HealthTaskType
)
from app.models.feed import FeedAddition, FeedTime, AdditionStatus
from app.models.medication_log import (
    WoundCareLog, HealthObservation, RehabProgram, RehabPhase,
    RehabTask, RehabStatus, TaskFrequency
)
from app.models.horse import Horse
from app.models.user import User


class HealthTaskGenerator:
    """Service for generating health-related yard tasks."""

    def __init__(self, db: Session, system_user_id: int):
        """
        Initialize the generator.

        Args:
            db: Database session
            system_user_id: User ID to use as reported_by for auto-generated tasks (usually admin)
        """
        self.db = db
        self.system_user_id = system_user_id

    def generate_all_for_date(self, target_date: date) -> dict:
        """
        Generate all health tasks for a given date.

        Returns dict with counts of generated tasks by type.
        """
        # First, delete any existing auto-generated health tasks for this date that are uncompleted
        self._cleanup_uncompleted_health_tasks(target_date)

        medication_count = len(self.generate_medication_tasks(target_date))
        wound_count = len(self.generate_wound_care_tasks(target_date))
        health_check_count = len(self.generate_health_check_tasks(target_date))
        rehab_count = len(self.generate_rehab_tasks(target_date))

        self.db.commit()

        return {
            "medication": medication_count,
            "wound_care": wound_count,
            "health_check": health_check_count,
            "rehab_exercise": rehab_count,
            "total": medication_count + wound_count + health_check_count + rehab_count
        }

    def _cleanup_uncompleted_health_tasks(self, target_date: date):
        """Remove uncompleted auto-generated health tasks for the target date."""
        self.db.query(YardTask).filter(
            YardTask.health_task_type.isnot(None),
            YardTask.scheduled_date == target_date,
            YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS])
        ).delete(synchronize_session=False)

    def generate_medication_tasks(self, target_date: date) -> List[YardTask]:
        """
        Generate medication administration tasks from active FeedAdditions.

        Creates one task per FeedAddition per feed time (morning/evening).
        FeedAdditions with feed_time='both' create two tasks.
        """
        tasks = []

        # Get all active, approved feed additions that are valid for the target date
        feed_additions = self.db.query(FeedAddition).join(Horse).filter(
            FeedAddition.status == AdditionStatus.APPROVED,
            FeedAddition.is_active == True,
            FeedAddition.start_date <= target_date,
            or_(
                FeedAddition.end_date.is_(None),
                FeedAddition.end_date >= target_date
            )
        ).all()

        for fa in feed_additions:
            # Determine which feed times to create tasks for
            feed_times = []
            if fa.feed_time == FeedTime.MORNING:
                feed_times = ['morning']
            elif fa.feed_time == FeedTime.EVENING:
                feed_times = ['evening']
            elif fa.feed_time == FeedTime.BOTH:
                feed_times = ['morning', 'evening']

            for ft in feed_times:
                # Check if task already exists
                existing = self.db.query(YardTask).filter(
                    YardTask.health_task_type == HealthTaskType.MEDICATION,
                    YardTask.feed_addition_id == fa.id,
                    YardTask.feed_time == ft,
                    YardTask.scheduled_date == target_date
                ).first()

                if existing:
                    continue

                task = YardTask(
                    title=f"{fa.horse.name}: {fa.name} ({ft})",
                    description=f"Administer {fa.dosage}\n{fa.reason or ''}".strip(),
                    category=TaskCategory.HEALTH,
                    priority=TaskPriority.MEDIUM,
                    reported_by_id=self.system_user_id,
                    reported_date=datetime.utcnow(),
                    assignment_type=AssignmentType.POOL,
                    scheduled_date=target_date,
                    status=TaskStatus.OPEN,
                    health_task_type=HealthTaskType.MEDICATION,
                    horse_id=fa.horse_id,
                    feed_addition_id=fa.id,
                    feed_time=ft
                )
                self.db.add(task)
                tasks.append(task)

        return tasks

    def generate_wound_care_tasks(self, target_date: date) -> List[YardTask]:
        """
        Generate wound care tasks for wounds with next_treatment_due on target date.
        """
        tasks = []

        # Get active wounds with treatment due on or before target date
        # We include overdue treatments to ensure they appear
        active_wounds = self.db.query(WoundCareLog).join(Horse).filter(
            WoundCareLog.is_resolved == False,
            WoundCareLog.next_treatment_due <= target_date
        ).distinct(WoundCareLog.horse_id, WoundCareLog.wound_name).all()

        for wound in active_wounds:
            # Check if task already exists
            existing = self.db.query(YardTask).filter(
                YardTask.health_task_type == HealthTaskType.WOUND_CARE,
                YardTask.wound_care_log_id == wound.id,
                YardTask.scheduled_date == target_date
            ).first()

            if existing:
                continue

            task = YardTask(
                title=f"{wound.horse.name}: Wound care - {wound.wound_name}",
                description=f"Location: {wound.wound_location or 'Not specified'}\n{wound.wound_description or ''}".strip(),
                category=TaskCategory.HEALTH,
                priority=TaskPriority.HIGH,  # Wound care is high priority
                reported_by_id=self.system_user_id,
                reported_date=datetime.utcnow(),
                assignment_type=AssignmentType.POOL,
                scheduled_date=target_date,
                status=TaskStatus.OPEN,
                health_task_type=HealthTaskType.WOUND_CARE,
                horse_id=wound.horse_id,
                wound_care_log_id=wound.id
            )
            self.db.add(task)
            tasks.append(task)

        return tasks

    def generate_health_check_tasks(self, target_date: date) -> List[YardTask]:
        """
        Generate daily health observation tasks for each livery horse.
        Creates one task per horse.
        """
        tasks = []

        # Get all livery horses (horses with livery_package_id set)
        horses = self.db.query(Horse).filter(
            Horse.livery_package_id.isnot(None)
        ).all()

        for horse in horses:
            # Check if task already exists
            existing = self.db.query(YardTask).filter(
                YardTask.health_task_type == HealthTaskType.HEALTH_CHECK,
                YardTask.horse_id == horse.id,
                YardTask.scheduled_date == target_date
            ).first()

            if existing:
                continue

            # Check if observation already logged today
            already_observed = self.db.query(HealthObservation).filter(
                HealthObservation.horse_id == horse.id,
                HealthObservation.observation_date == target_date
            ).first()

            if already_observed:
                continue

            task = YardTask(
                title=f"{horse.name}: Daily health check",
                description="Check appetite, demeanor, droppings, and general condition",
                category=TaskCategory.HEALTH,
                priority=TaskPriority.MEDIUM,
                reported_by_id=self.system_user_id,
                reported_date=datetime.utcnow(),
                assignment_type=AssignmentType.POOL,
                scheduled_date=target_date,
                status=TaskStatus.OPEN,
                health_task_type=HealthTaskType.HEALTH_CHECK,
                horse_id=horse.id
            )
            self.db.add(task)
            tasks.append(task)

        return tasks

    def generate_rehab_tasks(self, target_date: date) -> List[YardTask]:
        """
        Generate rehab exercise tasks from active rehab programs.

        For each active program, check which phase is current and generate
        tasks for the exercises in that phase based on their frequency.
        """
        tasks = []

        # Get active rehab programs
        programs = self.db.query(RehabProgram).filter(
            RehabProgram.status == RehabStatus.ACTIVE,
            RehabProgram.start_date <= target_date,
            or_(
                RehabProgram.expected_end_date.is_(None),
                RehabProgram.expected_end_date >= target_date
            )
        ).all()

        for program in programs:
            # Calculate which day of the program we're on
            days_since_start = (target_date - program.start_date).days + 1

            # Find the current phase
            current_phase = None
            for phase in program.phases:
                phase_end_day = phase.start_day + phase.duration_days - 1
                if phase.start_day <= days_since_start <= phase_end_day:
                    current_phase = phase
                    break

            if not current_phase:
                continue

            # Generate tasks for each exercise in the phase
            for rehab_task in current_phase.tasks:
                # Check frequency to see if task should run today
                if not self._should_run_today(rehab_task.frequency, target_date, program.start_date):
                    continue

                # Determine feed times based on frequency
                feed_times = self._get_feed_times_for_frequency(rehab_task.frequency)

                for ft in feed_times:
                    # Check if task already exists
                    existing = self.db.query(YardTask).filter(
                        YardTask.health_task_type == HealthTaskType.REHAB_EXERCISE,
                        YardTask.rehab_task_id == rehab_task.id,
                        YardTask.feed_time == ft,
                        YardTask.scheduled_date == target_date
                    ).first()

                    if existing:
                        continue

                    duration_str = f" ({rehab_task.duration_minutes}min)" if rehab_task.duration_minutes else ""

                    task = YardTask(
                        title=f"{program.horse.name}: {rehab_task.description}{duration_str}",
                        description=f"Program: {program.name}\nPhase: {current_phase.name}\n{rehab_task.instructions or ''}".strip(),
                        category=TaskCategory.HEALTH,
                        priority=TaskPriority.HIGH,  # Rehab exercises are high priority
                        location=rehab_task.equipment_needed,
                        reported_by_id=self.system_user_id,
                        reported_date=datetime.utcnow(),
                        assignment_type=AssignmentType.POOL,
                        scheduled_date=target_date,
                        status=TaskStatus.OPEN,
                        health_task_type=HealthTaskType.REHAB_EXERCISE,
                        horse_id=program.horse_id,
                        rehab_task_id=rehab_task.id,
                        rehab_program_id=program.id,
                        feed_time=ft
                    )
                    self.db.add(task)
                    tasks.append(task)

        return tasks

    def _should_run_today(self, frequency: TaskFrequency, target_date: date, program_start: date) -> bool:
        """Check if a task with given frequency should run on target date."""
        if frequency == TaskFrequency.DAILY:
            return True
        elif frequency == TaskFrequency.TWICE_DAILY:
            return True
        elif frequency == TaskFrequency.EVERY_OTHER_DAY:
            days = (target_date - program_start).days
            return days % 2 == 0
        elif frequency == TaskFrequency.WEEKLY:
            days = (target_date - program_start).days
            return days % 7 == 0
        elif frequency == TaskFrequency.AS_NEEDED:
            return False  # Don't auto-generate as-needed tasks
        return True

    def _get_feed_times_for_frequency(self, frequency: TaskFrequency) -> List[str]:
        """Get feed times for task generation based on frequency."""
        if frequency == TaskFrequency.TWICE_DAILY:
            return ['morning', 'evening']
        return [None]  # Single task, no specific feed time
