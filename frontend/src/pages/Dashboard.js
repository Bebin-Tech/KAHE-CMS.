import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import {
    DoorOpen,
    School,
    Zap,
    GraduationCap,
    Search
} from 'lucide-react';

const Dashboard = () => {
    const navigate = useNavigate();
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
        total_labs: 0
    });
    const [loading, setLoading] = useState(true);

    const userName = localStorage.getItem('name') || 'Institutional User';

    // --- REFRESH ENGINE ---
    const fetchAll = async () => {
        try {
            const results = await Promise.allSettled([
                API.get('/dashboard-stats/')
            ]);

            const d = (idx) => results[idx].status === 'fulfilled' ? results[idx].value.data : null;

            if (d(0)) setStats(prev => ({ ...prev, ...d(0) }));
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
        { label: 'Faculty Count', value: stats.total_faculties, icon: GraduationCap, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
        { label: 'Total Spaces', value: stats.rooms, icon: School, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
        { label: 'Active Classes', value: stats.active, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' }
    ], [stats]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-white">
            <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] animate-pulse">Institutional Telemetry Booting...</p>
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
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none">Institutional ERP Dashboard - Session Live</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/classroom-tracking')}
                        className="px-6 py-4 bg-indigo-600 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-200 hover:scale-105 transition-all flex items-center gap-2"
                    >
                        <Search size={14} />
                        Class Rooms
                    </button>

                    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">Welcome back,</p>
                            <p className="text-sm font-black text-slate-800 mt-1">{userName}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-lg shadow-indigo-100">
                            {userName.charAt(0)}
                        </div>
                    </div>
                </div>
            </header>

            {/* ANALYTICS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {metrics.map((m) => (
                    <div key={m.label} className={`bg-white p-8 rounded-[2rem] border ${m.border} shadow-md group hover:shadow-xl transition-all duration-500 hover:-translate-y-1`}>
                        <div className="flex items-center justify-between mb-6">
                            <div className={`p-4 rounded-2xl ${m.bg} ${m.color} group-hover:scale-110 transition-transform`}>
                                <m.icon size={24} />
                            </div>
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Real-time</span>
                        </div>
                        <p className={`text-4xl font-black text-slate-900 tracking-tighter`}>{m.value}</p>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.25em] mt-2 group-hover:text-slate-800 transition-colors">{m.label}</p>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default Dashboard;
