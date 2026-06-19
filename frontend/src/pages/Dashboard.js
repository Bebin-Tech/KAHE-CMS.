import React, { useEffect, useState } from 'react';
import API from '../api';
import {
    AlertCircle,
    BarChart3,
    BookOpen,
    ClipboardList,
    DoorOpen,
    School,
    Users,
    Zap
} from 'lucide-react';

const Dashboard = () => {
    const [stats, setStats] = useState({
        rooms: 0,
        bookings: 0,
        active: 0,
        total_departments: 0,
        total_programs: 0,
        total_semesters: 0,
        total_subjects: 0,
        total_faculties: 0,
        total_classrooms: 0,
        total_labs: 0,
        generated_timetables: 0,
        pending_approvals: 0,
        approved_timetables: 0,
        conflict_alerts: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [curricula, setCurricula] = useState([]);
    const [timetables, setTimetables] = useState([]);
    const [conflicts, setConflicts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [statsRes, roomsRes, historyRes, curriculaRes, timetablesRes, conflictsRes] = await Promise.allSettled([
                    API.get('/dashboard-stats'),
                    API.get('/rooms'),
                    API.get('/class-history'),
                    API.get('/curricula'),
                    API.get('/timetables'),
                    API.get('/timetable-conflicts')
                ]);

                if (statsRes.status === 'fulfilled') setStats(prev => ({ ...prev, ...statsRes.value.data }));
                if (roomsRes.status === 'fulfilled') setRooms(Array.isArray(roomsRes.value.data) ? roomsRes.value.data : []);
                if (historyRes.status === 'fulfilled') setRecentActivity(Array.isArray(historyRes.value.data) ? historyRes.value.data.slice(0, 5) : []);
                if (curriculaRes.status === 'fulfilled') setCurricula(Array.isArray(curriculaRes.value.data) ? curriculaRes.value.data : []);
                if (timetablesRes.status === 'fulfilled') setTimetables(Array.isArray(timetablesRes.value.data) ? timetablesRes.value.data : []);
                if (conflictsRes.status === 'fulfilled') setConflicts(Array.isArray(conflictsRes.value.data) ? conflictsRes.value.data : []);

                setLoading(false);
            } catch (err) {
                console.error("Dashboard data fetch failed:", err);
                setLoading(false);
            }
        };

        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 5000); // 5s interval for real-time updates
        return () => clearInterval(interval);
    }, []);

    const activeSessions = recentActivity.filter(item => item?.status === 'ACTIVE').length || stats.active || 0;
    const classroomCount = stats.total_classrooms || rooms.filter(room => room?.type === 'Classroom').length || stats.rooms || 0;
    const generatedSlots = timetables.filter(slot => !slot?.is_deleted).length || stats.generated_timetables || 0;
    const roomUtilization = stats.classroom_utilization ?? stats.room_utilization ?? 0;
    const securityAlerts = conflicts.length || stats.conflict_alerts || 0;

    const cards = [
        {
            label: 'Departments',
            value: stats.total_departments || 0,
            icon: DoorOpen,
            color: 'text-blue-600',
            iconBg: 'bg-blue-50'
        },
        {
            label: 'Curriculum',
            value: curricula.length || stats.total_subjects || 0,
            icon: BookOpen,
            color: 'text-indigo-600',
            iconBg: 'bg-indigo-50'
        },
        {
            label: 'Faculty Count',
            value: stats.total_faculties || 0,
            icon: Users,
            color: 'text-violet-600',
            iconBg: 'bg-violet-50'
        },
        {
            label: 'Classrooms',
            value: classroomCount,
            icon: School,
            color: 'text-emerald-600',
            iconBg: 'bg-emerald-50'
        },
        {
            label: 'Active Sessions',
            value: activeSessions,
            icon: Zap,
            color: 'text-amber-600',
            iconBg: 'bg-amber-50'
        },
        {
            label: 'Generated Slots',
            value: generatedSlots,
            icon: ClipboardList,
            color: 'text-sky-600',
            iconBg: 'bg-sky-50'
        },
        {
            label: 'Room Utilization',
            value: `${roomUtilization}%`,
            icon: BarChart3,
            color: 'text-slate-600',
            iconBg: 'bg-slate-50'
        },
        {
            label: 'Security Alerts',
            value: securityAlerts,
            icon: AlertCircle,
            color: 'text-rose-600',
            iconBg: 'bg-rose-50'
        }
    ];

    if (loading) return <div className="p-10 text-center animate-pulse font-black text-gray-300 tracking-widest uppercase">Securing Institutional Data...</div>;

    return (
        <div className="min-h-screen bg-[#f7faff] p-5 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div key={item.label} className="min-h-[174px] rounded-[18px] border border-slate-200 bg-white px-6 py-7 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                            <div className="flex h-full flex-col items-center justify-center text-center">
                                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${item.iconBg}`}>
                                    <Icon className={`h-6 w-6 ${item.color}`} strokeWidth={2.4} />
                                </div>
                                <div className={`text-3xl font-black leading-none ${item.color}`}>
                                    {item.value}
                                </div>
                                <div className="mt-3 text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                                    {item.label}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

export default Dashboard;
