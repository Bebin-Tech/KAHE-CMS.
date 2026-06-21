import React, { useEffect, useState, useMemo } from 'react';
import API from '../api';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    BarChart3,
    BookOpen,
    ClipboardList,
    DoorOpen,
    School,
    Users,
    Zap,
    GraduationCap,
    ShieldCheck,
    Clock,
    ChevronRight,
    MapPin
} from 'lucide-react';

const Dashboard = () => {
    // --- DYNAMIC DATA STATE ---
    const [stats, setStats] = useState({
        rooms: 0,
        active: 0,
        total_departments: 0,
        total_programs: 0,
        total_semesters: 0,
        total_subjects: 0,
        total_faculties: 0,
        total_classrooms: 0,
        total_labs: 0,
        generated_timetables: 0,
        conflict_alerts: 0,
        room_utilization: 0
    });

    const [recentActivity, setRecentActivity] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [curricula, setCurricula] = useState([]);
    const [timetables, setTimetables] = useState([]);
    const [conflicts, setConflicts] = useState([]);
    const [loading, setLoading] = useState(true);

    const role = localStorage.getItem('role')?.toLowerCase();
    const userName = localStorage.getItem('name') || 'Institutional User';

    // --- REFRESH ENGINE ---
    const fetchAll = async () => {
        try {
            const results = await Promise.allSettled([
                API.get('/dashboard-stats/'),
                API.get('/rooms/'),
                API.get('/class-history/'),
                API.get('/curricula/'),
                API.get('/timetables/'),
                API.get('/timetable-conflicts/')
            ]);

            const d = (idx) => results[idx].status === 'fulfilled' ? results[idx].value.data : null;

            if (d(0)) setStats(prev => ({ ...prev, ...d(0) }));
            if (d(1)) setRooms(Array.isArray(d(1)) ? d(1) : []);
            if (d(2)) setRecentActivity(Array.isArray(d(2)) ? d(2).slice(0, 8) : []);
            if (d(3)) setCurricula(Array.isArray(d(3)) ? d(3) : []);
            if (d(4)) setTimetables(Array.isArray(d(4)) ? d(4) : []);
            if (d(5)) setConflicts(Array.isArray(d(5)) ? d(5) : []);

            setLoading(false);
        } catch (err) {
            console.error("Institutional Telemetry failure.");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        const timer = setInterval(fetchAll, 8000);
        return () => clearInterval(timer);
    }, []);

    // --- DERIVED METRICS ---
    const metrics = useMemo(() => [
        { label: 'Departments', value: stats.total_departments, icon: DoorOpen, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
        { label: 'Curriculum', value: curricula.length || stats.total_subjects, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
        { label: 'Faculty Count', value: stats.total_faculties, icon: GraduationCap, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
        { label: 'Total Spaces', value: stats.rooms, icon: School, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
        { label: 'Active Classes', value: stats.active, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        { label: 'Generated Slots', value: timetables.length, icon: ClipboardList, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' },
        { label: 'Utilization', value: `${stats.room_utilization || 0}%`, icon: BarChart3, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100' },
        { label: 'Conflict Alerts', value: conflicts.length || stats.conflict_alerts, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' }
    ], [stats, curricula, timetables, conflicts]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-white">
            <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Institutional Telemetry Booting...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-12">

            {/* WELCOME SECTION */}
            <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tightest uppercase italic">
                        Institutional <span className="text-indigo-600">Intelligence</span>
                    </h1>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="h-1 w-1 bg-green-500 rounded-full animate-pulse"></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Institutional ERP Dashboard • Session Live</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Welcome back,</p>
                        <p className="text-sm font-black text-slate-800 mt-1">{userName}</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-lg shadow-indigo-100">
                        {userName.charAt(0)}
                    </div>
                </div>
            </header>

            {/* ANALYTICS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {metrics.map((m) => (
                    <div key={m.label} className={`bg-white p-8 rounded-[2.5rem] border ${m.border} shadow-sm group hover:shadow-xl transition-all duration-500 hover:-translate-y-1`}>
                        <div className="flex items-center justify-between mb-6">
                            <div className={`p-4 rounded-2xl ${m.bg} ${m.color} group-hover:scale-110 transition-transform`}>
                                <m.icon size={24} />
                            </div>
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Real-time</span>
                        </div>
                        <p className={`text-4xl font-black text-slate-900 tracking-tighter`}>{m.value}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-2 group-hover:text-slate-600 transition-colors">{m.label}</p>
                    </div>
                ))}
            </div>

            {/* LIVE FEEDS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* RECENT ACTIVITY */}
                <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-10">
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight italic flex items-center gap-3">
                            <Clock size={20} className="text-indigo-600" /> Recent Institutional Activity
                        </h2>
                        <button className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1 group">
                            View Master Audit <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <div className="space-y-4 flex-1">
                        {recentActivity.map((activity, i) => (
                            <div key={i} className="flex items-center gap-5 p-5 bg-slate-50/50 rounded-2xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all group">
                                <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <MapPin size={18} className="opacity-50 group-hover:opacity-100" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                                        Room {rooms.find(r => r.id === activity.room_id)?.room_number || activity.room_id}
                                        <span className={`ml-2 px-2 py-0.5 rounded text-[8px] ${activity.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {activity.status}
                                        </span>
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-bold truncate mt-1">
                                        Identity @{activity.faculty_name} accessed space for {activity.subject || 'Academic Registry'}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                        {new Date(activity.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {recentActivity.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-center opacity-20">
                                <ShieldCheck size={64} className="mb-4" />
                                <p className="text-sm font-black uppercase tracking-widest">Registry Activity Log Clear</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* CAPACITY INSIGHTS */}
                <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>

                    <h2 className="text-xl font-black uppercase tracking-tight italic mb-10 relative z-10 flex items-center gap-3">
                        <ShieldCheck size={20} className="text-indigo-400" /> Registry Integrity
                    </h2>

                    <div className="space-y-8 relative z-10 flex-1">
                        {[
                            { label: 'Classroom Availability', val: stats.total_classrooms ? (100 - (stats.active / stats.total_classrooms * 100)).toFixed(0) : 0, color: 'bg-indigo-500' },
                            { label: 'Institutional Completion', val: stats.total_subjects ? (timetables.length / stats.total_subjects * 10).toFixed(0) : 0, color: 'bg-emerald-500' },
                            { label: 'Workload Optimization', val: 94, color: 'bg-violet-500' }
                        ].map((p, i) => (
                            <div key={i} className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{p.label}</p>
                                    <p className="text-lg font-black italic">{p.val}%</p>
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${p.val}%` }}
                                        transition={{ duration: 1.5, delay: i * 0.2 }}
                                        className={`h-full ${p.color} shadow-[0_0_20px_rgba(79,70,229,0.4)]`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 p-6 bg-white/5 rounded-3xl border border-white/10">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] mb-3">System Identity</p>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black">KC</div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-tight">KAHE CMS Stable Kernel</p>
                                <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mt-1">v4.0.1 Stable Edition</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
