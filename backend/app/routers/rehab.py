from datetime import date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.user import User
from app.models.horse import Horse
from app.models.feed import FeedTime
from app.models.medication_log import (
    RehabProgram, RehabPhase, RehabTask, RehabTaskLog,
    RehabStatus, TaskFrequency
)
from app.schemas.medication_log import (
    RehabProgramCreate, RehabProgramUpdate, RehabProgramResponse, RehabProgramSummary,
    RehabPhaseCreate, RehabPhaseResponse,
    RehabTaskCreate, RehabTaskResponse,
    RehabTaskLogCreate, RehabTaskLogResponse,
    DailyRehabTask
)
from app.utils.auth import get_current_user, require_roles

router = APIRouter(prefix="/rehab", tags=["rehab-programs"])


@router.get("/programs", response_model=List[RehabProgramSummary])
async def get_all_programs(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Get all rehab programs, optionally filtered by status."""
    query = db.query(RehabProgram).options(joinedload(RehabProgram.phases))

    if status_filter:
        query = query.filter(RehabProgram.status == RehabStatus(status_filter))

    programs = query.order_by(RehabProgram.start_date.desc()).all()

    return [
        RehabProgramSummary(
            id=prog.id,
            horse_id=prog.horse_id,
            horse_name=prog.horse.name,
            name=prog.name,
            status=prog.status,
            start_date=prog.start_date,
            expected_end_date=prog.expected_end_date,
            current_phase=prog.current_phase,
            total_phases=len(prog.phases),
            completed_phases=sum(1 for phase in prog.phases if phase.is_completed)
        )
        for prog in programs
    ]


@router.get("/programs/active", response_model=List[RehabProgramSummary])
async def get_active_programs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Get all active rehab programs."""
    programs = db.query(RehabProgram).options(
        joinedload(RehabProgram.phases)
    ).filter(
        RehabProgram.status == RehabStatus.ACTIVE
    ).order_by(RehabProgram.start_date).all()

    return [
        RehabProgramSummary(
            id=prog.id,
            horse_id=prog.horse_id,
            horse_name=prog.horse.name,
            name=prog.name,
            status=prog.status,
            start_date=prog.start_date,
            expected_end_date=prog.expected_end_date,
            current_phase=prog.current_phase,
            total_phases=len(prog.phases),
            completed_phases=sum(1 for phase in prog.phases if phase.is_completed)
        )
        for prog in programs
    ]


@router.get("/programs/{program_id}", response_model=RehabProgramResponse)
async def get_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a rehab program with all phases and tasks."""
    program = db.query(RehabProgram).options(
        joinedload(RehabProgram.phases).joinedload(RehabPhase.tasks)
    ).filter(RehabProgram.id == program_id).first()

    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    # Check access
    if current_user.role == "livery" and program.horse.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return RehabProgramResponse(
        id=program.id,
        horse_id=program.horse_id,
        name=program.name,
        description=program.description,
        reason=program.reason,
        prescribed_by=program.prescribed_by,
        prescription_date=program.prescription_date,
        start_date=program.start_date,
        expected_end_date=program.expected_end_date,
        actual_end_date=program.actual_end_date,
        status=program.status,
        current_phase=program.current_phase,
        notes=program.notes,
        created_by_id=program.created_by_id,
        created_at=program.created_at,
        updated_at=program.updated_at,
        horse_name=program.horse.name,
        created_by_name=program.created_by.name if program.created_by else None,
        phases=[
            RehabPhaseResponse(
                id=phase.id,
                program_id=phase.program_id,
                phase_number=phase.phase_number,
                name=phase.name,
                description=phase.description,
                duration_days=phase.duration_days,
                start_day=phase.start_day,
                is_completed=phase.is_completed,
                completed_date=phase.completed_date,
                completion_notes=phase.completion_notes,
                created_at=phase.created_at,
                tasks=[
                    RehabTaskResponse(
                        id=task.id,
                        phase_id=task.phase_id,
                        task_type=task.task_type,
                        description=task.description,
                        duration_minutes=task.duration_minutes,
                        frequency=task.frequency,
                        instructions=task.instructions,
                        equipment_needed=task.equipment_needed,
                        sequence=task.sequence,
                        created_at=task.created_at
                    )
                    for task in sorted(phase.tasks, key=lambda t: t.sequence)
                ]
            )
            for phase in sorted(program.phases, key=lambda p: p.phase_number)
        ]
    )


@router.get("/horse/{horse_id}/programs", response_model=List[RehabProgramSummary])
async def get_horse_programs(
    horse_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all rehab programs for a horse."""
    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        raise HTTPException(status_code=404, detail="Horse not found")

    # Check access
    if current_user.role == "livery" and horse.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    programs = db.query(RehabProgram).options(
        joinedload(RehabProgram.phases)
    ).filter(
        RehabProgram.horse_id == horse_id
    ).order_by(RehabProgram.start_date.desc()).all()

    return [
        RehabProgramSummary(
            id=prog.id,
            horse_id=prog.horse_id,
            horse_name=horse.name,
            name=prog.name,
            status=prog.status,
            start_date=prog.start_date,
            expected_end_date=prog.expected_end_date,
            current_phase=prog.current_phase,
            total_phases=len(prog.phases),
            completed_phases=len([p for p in prog.phases if p.is_completed])
        )
        for prog in programs
    ]


@router.post("/programs", response_model=RehabProgramResponse)
async def create_program(
    program_data: RehabProgramCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new rehab program with phases and tasks."""
    horse = db.query(Horse).filter(Horse.id == program_data.horse_id).first()
    if not horse:
        raise HTTPException(status_code=404, detail="Horse not found")

    # Livery users can only create programs for their own horses
    if current_user.role == "livery" and horse.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only create programs for your own horses")

    # Create program
    program = RehabProgram(
        horse_id=program_data.horse_id,
        name=program_data.name,
        description=program_data.description,
        reason=program_data.reason,
        prescribed_by=program_data.prescribed_by,
        prescription_date=program_data.prescription_date,
        start_date=program_data.start_date,
        expected_end_date=program_data.expected_end_date,
        notes=program_data.notes,
        created_by_id=current_user.id
    )
    db.add(program)
    db.flush()

    # Create phases and tasks
    for phase_data in program_data.phases:
        phase = RehabPhase(
            program_id=program.id,
            phase_number=phase_data.phase_number,
            name=phase_data.name,
            description=phase_data.description,
            duration_days=phase_data.duration_days,
            start_day=phase_data.start_day
        )
        db.add(phase)
        db.flush()

        for task_data in phase_data.tasks:
            task = RehabTask(
                phase_id=phase.id,
                task_type=task_data.task_type,
                description=task_data.description,
                duration_minutes=task_data.duration_minutes,
                frequency=task_data.frequency,
                instructions=task_data.instructions,
                equipment_needed=task_data.equipment_needed,
                sequence=task_data.sequence
            )
            db.add(task)

    db.commit()
    db.refresh(program)

    # Fetch full program with relationships
    return await get_program(program.id, db, current_user)


@router.put("/programs/{program_id}", response_model=RehabProgramResponse)
async def update_program(
    program_id: int,
    update: RehabProgramUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a rehab program."""
    program = db.query(RehabProgram).filter(RehabProgram.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    # Livery users can only update programs for their own horses
    if current_user.role == "livery" and program.horse.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update programs for your own horses")

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(program, field, value)

    db.commit()
    db.refresh(program)

    return await get_program(program.id, db, current_user)


@router.post("/programs/{program_id}/activate", response_model=RehabProgramResponse)
async def activate_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Activate a draft program."""
    program = db.query(RehabProgram).filter(RehabProgram.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    # Livery users can only activate programs for their own horses
    if current_user.role == "livery" and program.horse.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only activate programs for your own horses")

    if program.status != RehabStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft programs can be activated")

    program.status = RehabStatus.ACTIVE
    db.commit()

    # Auto-generate rehab exercise tasks for today
    from datetime import date
    from app.services.health_task_generator import HealthTaskGenerator
    generator = HealthTaskGenerator(db, current_user.id)
    generator.generate_rehab_tasks(date.today())
    db.commit()

    return await get_program(program.id, db, current_user)


@router.post("/programs/{program_id}/complete", response_model=RehabProgramResponse)
async def complete_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a program as completed."""
    program = db.query(RehabProgram).filter(RehabProgram.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    # Livery users can only complete programs for their own horses
    if current_user.role == "livery" and program.horse.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only complete programs for your own horses")

    program.status = RehabStatus.COMPLETED
    program.actual_end_date = date.today()
    db.commit()

    return await get_program(program.id, db, current_user)


@router.post("/programs/{program_id}/phases/{phase_id}/complete")
async def complete_phase(
    program_id: int,
    phase_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a phase as completed and advance to next."""
    phase = db.query(RehabPhase).filter(
        RehabPhase.id == phase_id,
        RehabPhase.program_id == program_id
    ).first()

    if not phase:
        raise HTTPException(status_code=404, detail="Phase not found")

    # Livery users can only complete phases for their own horses
    if current_user.role == "livery" and phase.program.horse.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only complete phases for your own horses")

    phase.is_completed = True
    phase.completed_date = date.today()
    phase.completion_notes = notes

    # Advance program to next phase
    program = phase.program
    next_phase = db.query(RehabPhase).filter(
        RehabPhase.program_id == program_id,
        RehabPhase.phase_number > phase.phase_number
    ).order_by(RehabPhase.phase_number).first()

    if next_phase:
        program.current_phase = next_phase.phase_number
    else:
        # No more phases - program complete
        program.status = RehabStatus.COMPLETED
        program.actual_end_date = date.today()

    db.commit()

    return {"message": "Phase completed", "next_phase": next_phase.phase_number if next_phase else None}


@router.get("/tasks/due/{target_date}", response_model=List[DailyRehabTask])
async def get_tasks_due(
    target_date: date,
    feed_time: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Get all rehab tasks due for a given date."""
    # Get active programs
    active_programs = db.query(RehabProgram).filter(
        RehabProgram.status == RehabStatus.ACTIVE
    ).all()

    tasks_due = []

    for program in active_programs:
        # Calculate which day of the program this is
        days_since_start = (target_date - program.start_date).days + 1
        if days_since_start < 1:
            continue  # Program hasn't started yet

        # Find current phase based on start_day and duration
        current_phase = None
        for phase in sorted(program.phases, key=lambda p: p.phase_number):
            phase_end_day = phase.start_day + phase.duration_days - 1
            if phase.start_day <= days_since_start <= phase_end_day:
                current_phase = phase
                break

        if not current_phase or current_phase.is_completed:
            continue

        # Get tasks for current phase
        for task in current_phase.tasks:
            # Check frequency
            should_do_today = False
            day_in_phase = days_since_start - current_phase.start_day + 1

            if task.frequency == TaskFrequency.DAILY:
                should_do_today = True
            elif task.frequency == TaskFrequency.TWICE_DAILY:
                should_do_today = True
            elif task.frequency == TaskFrequency.EVERY_OTHER_DAY:
                should_do_today = (day_in_phase % 2 == 1)
            elif task.frequency == TaskFrequency.WEEKLY:
                should_do_today = (day_in_phase % 7 == 1)
            elif task.frequency == TaskFrequency.AS_NEEDED:
                should_do_today = True  # Show but mark as optional

            if not should_do_today:
                continue

            # Check if already logged
            log_query = db.query(RehabTaskLog).filter(
                RehabTaskLog.task_id == task.id,
                RehabTaskLog.log_date == target_date
            )
            if feed_time and task.frequency == TaskFrequency.TWICE_DAILY:
                log_query = log_query.filter(RehabTaskLog.feed_time == FeedTime(feed_time))

            existing_log = log_query.first()

            tasks_due.append(DailyRehabTask(
                task_id=task.id,
                program_id=program.id,
                horse_id=program.horse_id,
                horse_name=program.horse.name,
                program_name=program.name,
                phase_name=current_phase.name,
                task_type=task.task_type,
                description=task.description,
                duration_minutes=task.duration_minutes,
                frequency=task.frequency,
                instructions=task.instructions,
                equipment_needed=task.equipment_needed,
                is_logged=existing_log is not None,
                log_id=existing_log.id if existing_log else None
            ))

    return sorted(tasks_due, key=lambda t: (t.horse_name, t.task_type))


@router.post("/tasks/log", response_model=RehabTaskLogResponse)
async def log_task_completion(
    log_data: RehabTaskLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Log completion of a rehab task."""
    task = db.query(RehabTask).filter(RehabTask.id == log_data.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Get the horse to check ownership
    horse = db.query(Horse).filter(Horse.id == log_data.horse_id).first()
    if not horse:
        raise HTTPException(status_code=404, detail="Horse not found")

    # Livery users can only log tasks for their own horses
    if current_user.role == "livery" and horse.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only log tasks for your own horses")

    log = RehabTaskLog(
        task_id=log_data.task_id,
        program_id=log_data.program_id,
        horse_id=log_data.horse_id,
        log_date=log_data.log_date,
        feed_time=FeedTime(log_data.feed_time) if log_data.feed_time else None,
        was_completed=log_data.was_completed,
        skip_reason=log_data.skip_reason,
        actual_duration_minutes=log_data.actual_duration_minutes,
        horse_response=log_data.horse_response,
        concerns=log_data.concerns,
        vet_notified=log_data.vet_notified,
        completed_by_id=current_user.id
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return RehabTaskLogResponse(
        id=log.id,
        task_id=log.task_id,
        program_id=log.program_id,
        horse_id=log.horse_id,
        log_date=log.log_date,
        feed_time=log.feed_time.value if log.feed_time else None,
        was_completed=log.was_completed,
        skip_reason=log.skip_reason,
        actual_duration_minutes=log.actual_duration_minutes,
        horse_response=log.horse_response,
        concerns=log.concerns,
        vet_notified=log.vet_notified,
        completed_by_id=log.completed_by_id,
        completed_at=log.completed_at,
        task_description=task.description,
        completed_by_name=current_user.name,
        completed_by_role=current_user.role,
        completed_via='direct'
    )


@router.get("/tasks/log/{horse_id}", response_model=List[RehabTaskLogResponse])
async def get_horse_task_logs(
    horse_id: int,
    program_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get rehab task logs for a horse."""
    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        raise HTTPException(status_code=404, detail="Horse not found")

    # Check access
    if current_user.role == "livery" and horse.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    query = db.query(RehabTaskLog).filter(RehabTaskLog.horse_id == horse_id)

    if program_id:
        query = query.filter(RehabTaskLog.program_id == program_id)
    if start_date:
        query = query.filter(RehabTaskLog.log_date >= start_date)
    if end_date:
        query = query.filter(RehabTaskLog.log_date <= end_date)

    logs = query.order_by(RehabTaskLog.log_date.desc()).all()

    return [
        RehabTaskLogResponse(
            id=log.id,
            task_id=log.task_id,
            program_id=log.program_id,
            horse_id=log.horse_id,
            log_date=log.log_date,
            feed_time=log.feed_time.value if log.feed_time else None,
            was_completed=log.was_completed,
            skip_reason=log.skip_reason,
            actual_duration_minutes=log.actual_duration_minutes,
            horse_response=log.horse_response,
            concerns=log.concerns,
            vet_notified=log.vet_notified,
            completed_by_id=log.completed_by_id,
            completed_at=log.completed_at,
            task_description=log.task.description if log.task else None,
            completed_by_name=log.completed_by.name if log.completed_by else None,
            completed_by_role=log.completed_by.role if log.completed_by else None,
            completed_via='direct'  # Will be updated when yard_tasks integration is added
        )
        for log in logs
    ]


@router.get("/tasks/due/horse/{horse_id}/{target_date}", response_model=List[DailyRehabTask])
async def get_horse_tasks_due(
    horse_id: int,
    target_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get rehab tasks due for a specific horse on a given date. Available to horse owner."""
    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        raise HTTPException(status_code=404, detail="Horse not found")

    # Livery users can only view tasks for their own horses
    if current_user.role == "livery" and horse.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get active programs for this horse
    active_programs = db.query(RehabProgram).filter(
        RehabProgram.horse_id == horse_id,
        RehabProgram.status == RehabStatus.ACTIVE
    ).all()

    tasks_due = []

    for program in active_programs:
        # Calculate which day of the program this is
        days_since_start = (target_date - program.start_date).days + 1
        if days_since_start < 1:
            continue  # Program hasn't started yet

        # Find current phase based on start_day and duration
        current_phase = None
        for phase in sorted(program.phases, key=lambda p: p.phase_number):
            phase_end_day = phase.start_day + phase.duration_days - 1
            if phase.start_day <= days_since_start <= phase_end_day:
                current_phase = phase
                break

        if not current_phase or current_phase.is_completed:
            continue

        # Get tasks for current phase
        for task in current_phase.tasks:
            # Check frequency
            should_do_today = False
            day_in_phase = days_since_start - current_phase.start_day + 1

            if task.frequency == TaskFrequency.DAILY:
                should_do_today = True
            elif task.frequency == TaskFrequency.TWICE_DAILY:
                should_do_today = True
            elif task.frequency == TaskFrequency.EVERY_OTHER_DAY:
                should_do_today = (day_in_phase % 2 == 1)
            elif task.frequency == TaskFrequency.WEEKLY:
                should_do_today = (day_in_phase % 7 == 1)
            elif task.frequency == TaskFrequency.AS_NEEDED:
                should_do_today = True  # Show but mark as optional

            if not should_do_today:
                continue

            # Check if already logged
            existing_log = db.query(RehabTaskLog).filter(
                RehabTaskLog.task_id == task.id,
                RehabTaskLog.log_date == target_date
            ).first()

            tasks_due.append(DailyRehabTask(
                task_id=task.id,
                program_id=program.id,
                horse_id=program.horse_id,
                horse_name=horse.name,
                program_name=program.name,
                phase_name=current_phase.name,
                task_type=task.task_type,
                description=task.description,
                duration_minutes=task.duration_minutes,
                frequency=task.frequency,
                instructions=task.instructions,
                equipment_needed=task.equipment_needed,
                is_logged=existing_log is not None,
                log_id=existing_log.id if existing_log else None
            ))

    return sorted(tasks_due, key=lambda t: t.task_type)
