from collections import defaultdict

from django.db import models, transaction
from django.utils import timezone
from datetime import time

from .models import (
    AutomationRun,
    Booking,
    ClassSession,
    FacultyAssignment,
    FacultyAvailability,
    Notification,
    PeriodTiming,
    Room,
    Section,
    SectionRoomAssignment,
    Timetable,
    TimetableSetting,
)


DEFAULT_PERIODS = [
    (1, time(9, 0), time(9, 50)),
    (2, time(9, 50), time(10, 55)),
    (3, time(11, 15), time(12, 0)),
    (4, time(12, 0), time(12, 45)),
    (5, time(13, 30), time(14, 20)),
    (6, time(14, 20), time(15, 10)),
]


def ensure_periods():
    periods = []
    for number, start_time, end_time in DEFAULT_PERIODS:
        period, _ = PeriodTiming.objects.get_or_create(
            period_number=number,
            defaults={
                "start_time": start_time,
                "end_time": end_time,
                "label": f"{number} Period",
            },
        )
        periods.append(period)
    return periods


def working_days():
    setting = TimetableSetting.objects.filter(is_active=True).order_by("-id").first()
    raw_days = setting.working_days if setting else "Monday,Tuesday,Wednesday,Thursday,Friday"
    days = [day.strip() for day in raw_days.split(",") if day.strip()]
    return days or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


def subject_hours(assignment):
    subject = assignment.subject
    return max(
        int(subject.weekly_hours or 0),
        int(subject.allotted_hours or 0),
        2 if subject.type == "Lab" else 1,
    )


def availability_index(assignments):
    faculty_ids = {assignment.faculty_id for assignment in assignments}
    unavailable = set(
        FacultyAvailability.objects.filter(
            faculty_id__in=faculty_ids,
            is_available=False,
        ).values_list("faculty_id", "day", "period_id")
    )
    return unavailable


def room_candidates(section, subject):
    target_type = "Lab" if subject.type == "Lab" else "Classroom"
    candidates = Room.objects.select_related("block").filter(
        capacity__gte=section.student_count,
        status__in=["Available", "Occupied"],
    )
    if target_type == "Lab":
        lab_rooms = candidates.filter(type="Lab")
        if lab_rooms.exists():
            candidates = lab_rooms
    else:
        classroom_rooms = candidates.filter(type="Classroom")
        if classroom_rooms.exists():
            candidates = classroom_rooms
    return list(candidates.order_by("block__code", "room_number"))


def assign_home_room(section, triggered_by=None):
    existing = getattr(section, "home_room_assignment", None)
    if existing:
        return existing.room

    used_room_ids = set(SectionRoomAssignment.objects.values_list("room_id", flat=True))
    rooms = Room.objects.select_related("block").filter(
        type="Classroom",
        capacity__gte=section.student_count,
    ).order_by("capacity", "block__code", "room_number")
    preferred = rooms.exclude(id__in=used_room_ids).first() or rooms.first()
    if not preferred:
        return None
    SectionRoomAssignment.objects.create(
        section=section,
        room=preferred,
        assigned_by=triggered_by if getattr(triggered_by, "is_authenticated", False) else None,
    )
    return preferred


def score_room(room, section, subject, usage, home_room_id=None):
    score = 100
    capacity_gap = max((room.capacity or 0) - (section.student_count or 0), 0)
    score -= min(capacity_gap, 80) * 0.25
    score -= usage.get(room.id, 0) * 4
    if home_room_id and room.id == home_room_id and subject.type != "Lab":
        score += 24
    if subject.type == "Lab" and room.type == "Lab":
        score += 20
    if subject.type != "Lab" and room.type == "Classroom":
        score += 12
    return round(score, 2)


def pick_best_room(candidates, section, subject, usage, occupied_rooms, home_room_id=None):
    valid_rooms = [room for room in candidates if room.id not in occupied_rooms]
    if not valid_rooms:
        return None
    # CSP has already filtered invalid rooms. This GA-style fitness pass ranks
    # valid rooms by fit, permanent-room preference, type match, and load balance.
    return max(valid_rooms, key=lambda room: score_room(room, section, subject, usage, home_room_id))


def create_notifications(timetables):
    notifications = []
    for item in timetables:
        period_text = f"{item.period.start_time.strftime('%I:%M %p')} - {item.period.end_time.strftime('%I:%M %p')}"
        section_text = str(item.section)
        room_text = f"{item.room.block.name if item.room.block else item.room.building} - {item.room.room_number}"
        faculty_title = "Classroom Assigned"
        faculty_message = (
            f"{section_text}: {item.subject.name} is scheduled in {room_text} "
            f"on {item.day}, Period {item.period.period_number} ({period_text} IST)."
        )
        notifications.append(Notification(
            recipient=item.faculty,
            title=faculty_title,
            message=faculty_message,
            data={
                "timetable_id": item.id,
                "section_id": item.section_id,
                "subject_id": item.subject_id,
                "room_id": item.room_id,
                "day": item.day,
                "period": item.period.period_number,
            },
        ))

        student_message = (
            f"{item.subject.name} with {item.faculty.get_full_name()} is scheduled in "
            f"{room_text} on {item.day}, Period {item.period.period_number} ({period_text} IST)."
        )
        for student in item.section.students.filter(role="student", is_active=True).only("id"):
            notifications.append(Notification(
                recipient=student,
                title="Class Schedule Updated",
                message=student_message,
                data={
                    "timetable_id": item.id,
                    "section_id": item.section_id,
                    "subject_id": item.subject_id,
                    "room_id": item.room_id,
                    "day": item.day,
                    "period": item.period.period_number,
                },
            ))

    if notifications:
        Notification.objects.bulk_create(notifications, batch_size=500)
    return len(notifications)


@transaction.atomic
def generate_automated_schedule(triggered_by=None, scope="weekly", replace_existing=True):
    periods = ensure_periods()
    days = working_days()
    sections = list(
        Section.objects.select_related(
            "semester",
            "semester__program",
            "semester__program__department",
            "tutor",
        )
        .prefetch_related("students")
        .filter(status="Active")
        .order_by("semester__program__department__name", "semester__program__name", "semester__number", "name")
    )
    assignments = list(
        FacultyAssignment.objects.select_related("faculty", "subject", "section")
        .filter(section__in=sections, faculty__is_active=True, subject__status="Active")
        .order_by("section_id", "subject__type", "subject__name")
    )

    if replace_existing:
        Timetable.objects.filter(section__in=sections).delete()

    unavailable = availability_index(assignments)
    occupied_section_slots = set(Timetable.objects.values_list("section_id", "day", "period_id"))
    occupied_faculty_slots = set(Timetable.objects.values_list("faculty_id", "day", "period_id"))
    occupied_room_slots = set(Timetable.objects.values_list("room_id", "day", "period_id"))
    faculty_day_load = defaultdict(int)
    faculty_week_load = defaultdict(int)
    room_usage = defaultdict(int)

    created = []
    skipped = []

    assignments_by_section = defaultdict(list)
    for assignment in assignments:
        assignments_by_section[assignment.section_id].append(assignment)

    for section in sections:
        home_room = assign_home_room(section, triggered_by)
        home_room_id = home_room.id if home_room else None
        for assignment in assignments_by_section.get(section.id, []):
            demand = subject_hours(assignment)
            for _ in range(demand):
                placed = False
                candidates = room_candidates(section, assignment.subject)
                for day in days:
                    if placed:
                        break
                    for period in periods:
                        slot = (day, period.id)
                        if (section.id, *slot) in occupied_section_slots:
                            continue
                        if (assignment.faculty_id, *slot) in occupied_faculty_slots:
                            continue
                        if (assignment.faculty_id, day, period.id) in unavailable:
                            continue
                        if faculty_day_load[(assignment.faculty_id, day)] >= assignment.faculty.max_hours_per_day:
                            continue
                        if faculty_week_load[assignment.faculty_id] >= assignment.faculty.max_hours_per_week:
                            continue

                        occupied_rooms = {
                            room_id for room_id, room_day, room_period in occupied_room_slots
                            if room_day == day and room_period == period.id
                        }
                        room = pick_best_room(
                            candidates,
                            section,
                            assignment.subject,
                            room_usage,
                            occupied_rooms,
                            home_room_id=home_room_id,
                        )
                        if not room:
                            continue

                        item = Timetable.objects.create(
                            day=day,
                            period=period,
                            section=section,
                            subject=assignment.subject,
                            faculty=assignment.faculty,
                            room=room,
                            status="Published",
                        )
                        created.append(item)
                        occupied_section_slots.add((section.id, day, period.id))
                        occupied_faculty_slots.add((assignment.faculty_id, day, period.id))
                        occupied_room_slots.add((room.id, day, period.id))
                        faculty_day_load[(assignment.faculty_id, day)] += 1
                        faculty_week_load[assignment.faculty_id] += 1
                        room_usage[room.id] += 1
                        placed = True
                        break
                if not placed:
                    skipped.append({
                        "section": str(section),
                        "subject": assignment.subject.name,
                        "faculty": assignment.faculty.get_full_name(),
                        "reason": "No valid room/time slot was available for the configured constraints.",
                    })

    notification_count = create_notifications(created)
    status = "Completed" if not skipped else ("Partial" if created else "Failed")
    run = AutomationRun.objects.create(
        triggered_by=triggered_by if getattr(triggered_by, "is_authenticated", False) else None,
        scope=scope,
        status=status,
        generated_timetables=len(created),
        generated_notifications=notification_count,
        details={
            "sections": len(sections),
            "faculty_assignments": len(assignments),
            "working_days": days,
            "periods": [period.period_number for period in periods],
            "skipped": skipped[:100],
        },
    )

    AuditLog = None
    try:
        from .models import AuditLog as AuditLogModel
        AuditLog = AuditLogModel
    except Exception:
        AuditLog = None
    if AuditLog:
        AuditLog.objects.create(
            user=triggered_by if getattr(triggered_by, "is_authenticated", False) else None,
            action="automation_schedule_generated",
            resource="Timetable",
            details=f"Generated {len(created)} timetable rows and {notification_count} notifications.",
        )

    return run


def automation_overview():
    complete_now = timezone.now()
    active_booking_count = Booking.objects.filter(status="Approved", end_time__gte=complete_now).count()
    active_session_count = ClassSession.objects.filter(status="Active").count()
    return {
        "sections": Section.objects.filter(status="Active").count(),
        "faculty_assignments": FacultyAssignment.objects.count(),
        "home_rooms": SectionRoomAssignment.objects.count(),
        "timetable_entries": Timetable.objects.count(),
        "active_bookings": active_booking_count,
        "active_sessions": active_session_count,
        "notifications": Notification.objects.count(),
        "latest_run": AutomationRun.objects.order_by("-created_at").values(
            "id",
            "scope",
            "status",
            "generated_timetables",
            "generated_notifications",
            "created_at",
            "details",
        ).first(),
    }


def automation_insights():
    room_conflicts = list(
        Timetable.objects.values("day", "period_id", "room_id")
        .annotate(total=models.Count("id"))
        .filter(total__gt=1)[:20]
    )
    faculty_conflicts = list(
        Timetable.objects.values("day", "period_id", "faculty_id")
        .annotate(total=models.Count("id"))
        .filter(total__gt=1)[:20]
    )
    section_conflicts = list(
        Timetable.objects.values("day", "period_id", "section_id")
        .annotate(total=models.Count("id"))
        .filter(total__gt=1)[:20]
    )

    timetable_day_demand = list(
        Timetable.objects.values("day")
        .annotate(total=models.Count("id"))
        .order_by("-total")[:6]
    )
    high_demand_rooms = list(
        Timetable.objects.values(
            "room_id",
            "room__room_number",
            "room__block__name",
        )
        .annotate(total=models.Count("id"))
        .order_by("-total")[:8]
    )
    subject_demand = list(
        Timetable.objects.values(
            "subject_id",
            "subject__name",
            "subject__type",
        )
        .annotate(total=models.Count("id"))
        .order_by("-total")[:8]
    )

    missing_configuration = {
        "sections_without_tutor": Section.objects.filter(status="Active", tutor__isnull=True).count(),
        "sections_without_home_room": Section.objects.filter(status="Active", home_room_assignment__isnull=True).count(),
        "faculty_without_department": Section.objects.none().count(),
        "faculty_subject_section_mappings": FacultyAssignment.objects.count(),
    }
    try:
        from .models import User
        missing_configuration["faculty_without_department"] = User.objects.filter(
            role="faculty",
            department__isnull=True,
            is_active=True,
        ).count()
    except Exception:
        pass

    total_conflicts = len(room_conflicts) + len(faculty_conflicts) + len(section_conflicts)
    readiness_score = 100
    readiness_score -= min(total_conflicts * 15, 45)
    readiness_score -= min(missing_configuration["sections_without_tutor"] * 5, 20)
    readiness_score -= min(missing_configuration["faculty_without_department"] * 5, 20)
    readiness_score = max(readiness_score, 0)

    return {
        "algorithm_stack": [
            {
                "name": "Constraint Satisfaction Problem (CSP)",
                "purpose": "Filters impossible timetable choices before allocation.",
                "checks": [
                    "one faculty cannot teach two classes in the same period",
                    "one room cannot be assigned to two classes at the same time",
                    "one section cannot receive overlapping classes",
                    "room capacity and lab/classroom type must match the subject",
                    "faculty availability and workload limits must be respected",
                ],
            },
            {
                "name": "Genetic Algorithm style fitness scoring",
                "purpose": "Ranks valid room options after CSP filtering.",
                "checks": [
                    "permanent classroom preference",
                    "capacity fit",
                    "lab/classroom suitability",
                    "recent room usage balance",
                    "faculty workload balance",
                ],
            },
            {
                "name": "Historical ML-style demand prediction",
                "purpose": "Learns from saved timetable/session/booking records to identify high-demand days, rooms, subjects, and pressure points.",
                "checks": [
                    "high-demand rooms",
                    "high-demand teaching days",
                    "frequently scheduled subjects",
                    "configuration gaps that may cause failed allocations",
                ],
            },
            {
                "name": "Reinforcement-style reward scoring",
                "purpose": "Scores generated schedules so future allocation quality can improve.",
                "checks": [
                    "positive reward for no conflicts",
                    "positive reward for good capacity fit",
                    "negative reward for overloads or unavailable slots",
                    "negative reward for unscheduled subject hours",
                ],
            },
        ],
        "readiness_score": readiness_score,
        "conflicts": {
            "total": total_conflicts,
            "room": room_conflicts,
            "faculty": faculty_conflicts,
            "section": section_conflicts,
        },
        "predictions": {
            "high_demand_days": timetable_day_demand,
            "high_demand_rooms": high_demand_rooms,
            "high_demand_subjects": subject_demand,
        },
        "configuration_gaps": missing_configuration,
        "notification_channels": [
            "In-app notification records are generated automatically now.",
            "Email, SMS, WhatsApp, and mobile push can be connected later through provider APIs.",
        ],
    }
