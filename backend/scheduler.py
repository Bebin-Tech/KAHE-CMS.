from ortools.sat.python import cp_model
from sqlalchemy.orm import Session
from sqlalchemy import and_
try:
    from . import models
except ImportError:
    import models
import logging

logger = logging.getLogger("KAHE-CMS-Scheduler")

class TimetableSolver:
    def __init__(self, db: Session, department_id=None, semester_id=None):
        self.db = db
        self.department_id = department_id
        self.semester_id = semester_id
        self.model = cp_model.CpModel()
        
        self.days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        self.class_periods = [1, 2, 3, 4, 5, 6] 
        
        # Resources
        self.rooms = self.db.query(models.Room).filter(models.Room.is_deleted == False).all()
        self.faculty = self.db.query(models.User).filter(and_(models.User.role == "faculty", models.User.is_deleted == False)).all()
        
        # Scope Definition
        query = self.db.query(models.Section).filter(models.Section.is_deleted == False)
        if self.semester_id:
            query = query.filter(models.Section.semester_id == self.semester_id)
        elif self.department_id:
            query = query.join(models.Semester).join(models.Program).filter(models.Program.department_id == self.department_id)
        
        self.all_sections = query.all()
        if not self.all_sections:
            sem_query = self.db.query(models.Semester).filter(models.Semester.is_deleted == False)
            if self.semester_id: sem_query = sem_query.filter(models.Semester.id == self.semester_id)
            self.semesters = sem_query.all()
        else:
            self.semesters = list(set(sec.semester for sec in self.all_sections))

    def validate_prerequisites(self):
        """Validates if mandatory data for timetable generation is present."""
        errors = []
        if not self.rooms: errors.append("No active classrooms found in registry.")
        if not self.faculty: errors.append("No active faculty found in registry.")
        
        target_entities = self.all_sections if self.all_sections else self.semesters
        if not target_entities: errors.append("No target semesters/sections found for generation.")
        
        # Check faculty mapping and subject allocation
        for entity in target_entities:
            sem_id = entity.semester_id if hasattr(entity, 'semester_id') else entity.id
            subs = self.db.query(models.Subject).filter(models.Subject.semester_id == sem_id, models.Subject.is_deleted == False).all()
            if not subs:
                errors.append(f"No subjects allocated for Semester {sem_id}.")
            
            for s in subs:
                if not s.weekly_hours:
                    errors.append(f"Subject '{s.name}' has no weekly hours assigned.")
        
        return errors

    def solve(self):
        prereq_errors = self.validate_prerequisites()
        if prereq_errors:
            logger.error(f"Prerequisite failure: {prereq_errors}")
            raise Exception(". ".join(prereq_errors))

        class_subjects = {}
        target_entities = self.all_sections if self.all_sections else self.semesters
        
        for entity in target_entities:
            sem_id = entity.semester_id if hasattr(entity, 'semester_id') else entity.id
            sec_name = entity.name if hasattr(entity, 'name') else "A"
            c_id = f"SEM{sem_id}_SEC{sec_name}"
            
            subs = self.db.query(models.Subject).filter(
                models.Subject.semester_id == sem_id,
                models.Subject.is_deleted == False
            ).all()
            
            subject_data = []
            for s in subs:
                assignment = self.db.query(models.FacultyAssignment).filter(
                    models.FacultyAssignment.subject_id == s.id,
                    models.FacultyAssignment.section == sec_name,
                    models.FacultyAssignment.is_deleted == False
                ).first()
                f_id = assignment.faculty_id if assignment else s.preferred_faculty_id
                if f_id:
                    subject_data.append({"subject": s, "faculty_id": f_id})
            
            class_subjects[c_id] = {"entity": entity, "subs": subject_data}

        # Decision Variables: X[class, day, period, subject_index, room_index]
        # To simplify and ensure room constraints, we include room in the decision.
        # But for large colleges, this might explode. 
        # Alternatively: X[class, day, period, subject_index] and then assign rooms separately.
        # Let's try: X[class, day, period, subject_index] and check room conflicts.
        
        vars = {}
        for c_id, data in class_subjects.items():
            for d in self.days:
                for p in self.class_periods:
                    for s_idx in range(len(data["subs"])):
                        vars[(c_id, d, p, s_idx)] = self.model.NewBoolVar(f'v_{c_id}_{d}_{p}_{s_idx}')

        # CONSTRAINTS
        
        # 1. Each class: at most one subject per period
        for c_id, data in class_subjects.items():
            for d in self.days:
                for p in self.class_periods:
                    self.model.Add(sum(vars[(c_id, d, p, s_idx)] for s_idx in range(len(data["subs"]))) <= 1)

        # 2. Weekly Hours Completion
        for c_id, data in class_subjects.items():
            for s_idx, s_info in enumerate(data["subs"]):
                target = s_info["subject"].weekly_hours or 3
                self.model.Add(sum(vars[(c_id, d, p, s_idx)] for d in self.days for p in self.class_periods) == target)

                # 3. Lab blocks (adjacent periods)
                if s_info["subject"].type == "Lab":
                    for d in self.days:
                        # Logic: If scheduled, must be in pairs: P1-P2, P3-P4, P5-P6
                        for p_pair in [(1,2), (3,4), (5,6)]:
                            self.model.Add(vars[(c_id, d, p_pair[0], s_idx)] == vars[(c_id, d, p_pair[1], s_idx)])

        # 4. Faculty Clash Prevention (No overlap across classes for same faculty)
        for f in self.faculty:
            for d in self.days:
                for p in self.class_periods:
                    f_usage = []
                    for c_id, data in class_subjects.items():
                        for s_idx, s_info in enumerate(data["subs"]):
                            if s_info["faculty_id"] == f.id:
                                f_usage.append(vars[(c_id, d, p, s_idx)])
                    if f_usage:
                        self.model.Add(sum(f_usage) <= 1)

        # 5. Balancing: Max 2 periods of same subject per day (Theory)
        for c_id, data in class_subjects.items():
            for s_idx, s_info in enumerate(data["subs"]):
                if s_info["subject"].type != "Lab":
                    for d in self.days:
                        self.model.Add(sum(vars[(c_id, d, p, s_idx)] for p in self.class_periods) <= 2)

        # 6. Faculty Workload Balancing (Soft constraint / Load Limit)
        for f in self.faculty:
            # Weekly limit
            weekly_usage = []
            for d in self.days:
                for p in self.class_periods:
                    for c_id, data in class_subjects.items():
                        for s_idx, s_info in enumerate(data["subs"]):
                            if s_info["faculty_id"] == f.id:
                                weekly_usage.append(vars[(c_id, d, p, s_idx)])
            if weekly_usage:
                self.model.Add(sum(weekly_usage) <= (f.max_hours_per_week or 24))

        # Objective: Prefer Theory in Morning (P1-P4)
        morning_bonus = []
        for c_id, data in class_subjects.items():
            for s_idx, s_info in enumerate(data["subs"]):
                if s_info["subject"].type == "Theory":
                    for d in self.days:
                        for p in [1, 2, 3, 4]:
                            if (c_id, d, p, s_idx) in vars:
                                morning_bonus.append(vars[(c_id, d, p, s_idx)])
        if morning_bonus:
            self.model.Maximize(sum(morning_bonus))

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 20.0
        status = solver.Solve(self.model)

        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            self.save_results(solver, vars, class_subjects)
            return True
        return False

    def save_results(self, solver, vars, class_subjects):
        # Archive previous for relevant semesters
        sem_ids = [s.id for s in self.semesters]
        self.db.query(models.Timetable).filter(
            and_(models.Timetable.semester_id.in_(sem_ids), models.Timetable.is_deleted == False)
        ).update({"is_deleted": True}, synchronize_session='fetch')
        
        period_objs = self.db.query(models.PeriodTiming).filter(models.PeriodTiming.type == "CLASS").order_by(models.PeriodTiming.period_number).all()
        p_map = {p.period_number: p for p in period_objs}

        # Room allocation logic (Greedy assignment for now)
        room_usage = {} # (day, period, room_type) -> [room_ids_used]

        for c_id, data in class_subjects.items():
            entity = data["entity"]
            sem_id = entity.semester_id if hasattr(entity, 'semester_id') else entity.id
            sec_name = entity.name if hasattr(entity, 'name') else "A"
            sem = self.db.query(models.Semester).get(sem_id)

            for d in self.days:
                for p_num in self.class_periods:
                    for s_idx, s_info in enumerate(data["subs"]):
                        if solver.Value(vars[(c_id, d, p_num, s_idx)]):
                            sub = s_info["subject"]
                            fac = self.db.query(models.User).get(s_info["faculty_id"])
                            p_obj = p_map.get(p_num)
                            
                            # Assign room based on subject type
                            room_type = "Lab" if sub.type == "Lab" else "Classroom"
                            available_rooms = [r for r in self.rooms if r.type == room_type]
                            
                            assigned_room = None
                            for r in available_rooms:
                                key = (d, p_num, r.id)
                                if key not in room_usage:
                                    assigned_room = r
                                    room_usage[key] = True
                                    break
                            
                            self.db.add(models.Timetable(
                                semester_id=sem.id,
                                program_id=sem.program_id,
                                department_id=sem.program.department_id,
                                day_of_week=d,
                                period_id=p_obj.id if p_obj else None,
                                time_slot=f"{p_obj.start_time}-{p_obj.end_time}" if p_obj else f"P{p_num}",
                                subject_id=sub.id,
                                subject_name=sub.name,
                                subject_type=sub.type,
                                faculty_id=fac.id,
                                faculty_name=fac.name,
                                room_id=assigned_room.id if assigned_room else None,
                                room_number=assigned_room.room_number if assigned_room else "N/A",
                                section=sec_name,
                                semester_number=sem.number,
                                status="DRAFT"
                            ))
        self.db.commit()
        self.calculate_workloads()

    def calculate_workloads(self):
        """Updates FacultyWorkload table after generation."""
        faculties = self.db.query(models.User).filter(and_(models.User.role == "faculty", models.User.is_deleted == False)).all()
        for f in faculties:
            weekly_hours = self.db.query(models.Timetable).filter(
                and_(models.Timetable.faculty_id == f.id, models.Timetable.is_deleted == False)
            ).count()
            
            workload = self.db.query(models.FacultyWorkload).filter(models.FacultyWorkload.faculty_id == f.id).first()
            if not workload:
                workload = models.FacultyWorkload(faculty_id=f.id)
                self.db.add(workload)
            
            workload.total_hours_weekly = weekly_hours
            workload.total_hours_monthly = weekly_hours * 4
            cap = (f.max_hours_per_week or 24)
            workload.utilization_percentage = (weekly_hours / cap * 100) if cap > 0 else 0
        self.db.commit()
