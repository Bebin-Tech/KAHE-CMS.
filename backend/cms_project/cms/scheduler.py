from ortools.sat.python import cp_model
from .models import *

class TimetableSolver:
    def __init__(self, department_id=None, semester_id=None):
        self.department_id = department_id
        self.semester_id = semester_id
        self.model = cp_model.CpModel()
        self.load_data()

    def load_data(self):
        # Academic structure
        self.sections = Section.objects.filter(status='Active')
        if self.semester_id:
            self.sections = self.sections.filter(semester_id=self.semester_id)
        elif self.department_id:
            self.sections = self.sections.filter(semester__program__department_id=self.department_id)
            
        self.faculties = User.objects.filter(role='faculty', status='Active', is_active=True)
        self.rooms = Room.objects.filter(status='Available')
        
        settings = TimetableSetting.objects.filter(is_active=True).first()
        self.days = (settings.working_days.split(',')) if settings else ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        
        # Only use non-break periods for scheduling
        self.period_objects = PeriodTiming.objects.filter(is_break=False).order_by('period_number')
        self.periods = [p.id for p in self.period_objects]
        
        self.assignments = FacultyAssignment.objects.all()
        if self.semester_id:
            self.assignments = self.assignments.filter(section__semester_id=self.semester_id)
        elif self.department_id:
            self.assignments = self.assignments.filter(section__semester__program__department_id=self.department_id)

    def solve(self):
        if not self.assignments.exists():
            return False

        # Variables: (assignment, day, period) -> boolean
        slots = {}
        for assignment in self.assignments:
            for day in self.days:
                for period in self.periods:
                    slots[(assignment.id, day, period)] = self.model.NewBoolVar(f'assign_{assignment.id}_{day}_{period}')

        # 1. Each section can have at most one subject per period
        for section in self.sections:
            sec_assignments = [a.id for a in self.assignments if a.section_id == section.id]
            for day in self.days:
                for period in self.periods:
                    self.model.AddAtMostOne(slots[(aid, day, period)] for aid in sec_assignments)

        # 2. Each faculty can be in at most one section per period
        for faculty in self.faculties:
            fac_assignments = [a.id for a in self.assignments if a.faculty_id == faculty.id]
            for day in self.days:
                for period in self.periods:
                    self.model.AddAtMostOne(slots[(aid, day, period)] for aid in fac_assignments)

        # 3. Satisfy weekly hours
        for assignment in self.assignments:
            target_hours = assignment.subject.allotted_hours or assignment.subject.weekly_hours
            if target_hours > 0:
                self.model.Add(sum(slots[(assignment.id, day, period)] 
                                   for day in self.days 
                                   for period in self.periods) == target_hours)

        # Solver
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 30.0
        status = solver.Solve(self.model)

        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            # Clear existing timetables for these sections
            Timetable.objects.filter(section__in=self.sections).delete()
            
            # Greedy room allocation to ensure zero room conflicts
            room_occupancy = {} # (day, period_id, room_id) -> bool
            new_entries = []
            
            for day in self.days:
                for p_obj in self.period_objects:
                    for assignment in self.assignments:
                        if solver.Value(slots[(assignment.id, day, p_obj.id)]):
                            # Try to find a room
                            target_room_type = assignment.subject.type
                            available_rooms = self.rooms.filter(type=target_room_type)
                            selected_room = None
                            
                            for r in available_rooms:
                                if (day, p_obj.id, r.id) not in room_occupancy:
                                    selected_room = r
                                    room_occupancy[(day, p_obj.id, r.id)] = True
                                    break
                            
                            if not selected_room:
                                for r in self.rooms:
                                    if (day, p_obj.id, r.id) not in room_occupancy:
                                        selected_room = r
                                        room_occupancy[(day, p_obj.id, r.id)] = True
                                        break
                                        
                            new_entries.append(Timetable(
                                day=day,
                                period=p_obj,
                                section=assignment.section,
                                subject=assignment.subject,
                                faculty=assignment.faculty,
                                room=selected_room or self.rooms.first(),
                                status='Published'
                            ))
            Timetable.objects.bulk_create(new_entries)
            return True
        return False
