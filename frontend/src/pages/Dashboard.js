import React, { useEffect, useState, useMemo } from 'react';
import API from '../api';
import {
    ArrowUpRight,
    DoorOpen,
    GraduationCap,
    School,
    Zap
} from 'lucide-react';

const Dashboard = () => {
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

    const fetchAll = async () => {
        try {
            const results = await Promise.allSettled([
                API.get('/dashboard-stats/')
            ]);

            const d = (idx) => results[idx].status === 'fulfilled' ? results[idx].value.data : null;

            if (d(0)) setStats(prev => ({ ...prev, ...d(0) }));
            setLoading(false);
        } catch (err) {
            console.error('Dashboard sync failed.');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        const refreshIfVisible = () => {
            if (!document.hidden) fetchAll();
        };
        const timer = setInterval(refreshIfVisible, 30000);
        document.addEventListener('visibilitychange', refreshIfVisible);
        window.addEventListener('focus', refreshIfVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', refreshIfVisible);
            window.removeEventListener('focus', refreshIfVisible);
        };
    }, []);

    const metrics = useMemo(() => [
        {
            label: 'Departments',
            value: stats.total_departments,
            icon: DoorOpen,
            note: 'Academic units',
            accent: 'bg-sky-500',
            iconBox: 'bg-sky-50 text-sky-700',
            footer: 'text-sky-700 bg-sky-50 border-sky-100'
        },
        {
            label: 'Faculty Count',
            value: stats.total_faculties,
            icon: GraduationCap,
            note: 'Teaching accounts',
            accent: 'bg-fuchsia-500',
            iconBox: 'bg-fuchsia-50 text-fuchsia-700',
            footer: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-100'
        },
        {
            label: 'Total Spaces',
            value: stats.rooms,
            icon: School,
            note: 'Rooms and labs',
            accent: 'bg-emerald-500',
            iconBox: 'bg-emerald-50 text-emerald-700',
            footer: 'text-emerald-700 bg-emerald-50 border-emerald-100'
        },
        {
            label: 'Active Classes',
            value: stats.active,
            icon: Zap,
            note: 'Live sessions',
            accent: 'bg-amber-500',
            iconBox: 'bg-amber-50 text-amber-700',
            footer: 'text-amber-700 bg-amber-50 border-amber-100'
        }
    ], [stats]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-white">
            <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] animate-pulse">Dashboard Loading...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-10">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tightest uppercase italic">
                        Welcome Back <span className="text-indigo-600">Admin</span>
                    </h1>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                        Live campus overview
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5 mb-8">
                {metrics.map((m) => (
                    <div
                        key={m.label}
                        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                    >
                        <div className={`absolute inset-y-0 left-0 w-1.5 ${m.accent}`} />
                        <div className="p-5 sm:p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{m.label}</p>
                                    <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{m.value}</p>
                                </div>
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${m.iconBox}`}>
                                    <m.icon size={23} />
                                </div>
                            </div>

                            <div className="mt-5 flex items-center justify-between gap-3">
                                <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${m.footer}`}>
                                    {m.note}
                                </span>
                                <ArrowUpRight className="h-4 w-4 text-slate-400" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">System Status</p>
                        <h2 className="mt-2 text-xl font-black text-slate-900">Classroom availability is ready to monitor.</h2>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-emerald-700">
                        <Zap size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Live Sync Active</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
