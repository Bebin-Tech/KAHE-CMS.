import React, { useEffect, useState } from 'react';
import API from '../api';

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
    const [loading, setLoading] = useState(true);

    const role = localStorage.getItem('role')?.toLowerCase();
    const userName = localStorage.getItem('name');

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch stats and rooms in parallel
                const [statsRes, roomsRes, historyRes] = await Promise.allSettled([
                    API.get('/dashboard-stats'),
                    API.get('/rooms'),
                    API.get('/class-history')
                ]);

                if (statsRes.status === 'fulfilled') setStats(prev => ({ ...prev, ...statsRes.value.data }));
                if (roomsRes.status === 'fulfilled') setRooms(Array.isArray(roomsRes.value.data) ? roomsRes.value.data : []);
                if (historyRes.status === 'fulfilled') setRecentActivity(Array.isArray(historyRes.value.data) ? historyRes.value.data.slice(0, 5) : []);

                setLoading(false);
            } catch (err) {
                console.error("Dashboard data fetch failed:", err);
                setLoading(false);
            }
        };

        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 30000);
        return () => clearInterval(interval);
    }, []);

    const getTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    const handleClearActivity = async () => {
        if (window.confirm('Are you sure you want to clear all recent activity?')) {
            try {
                await API.delete('/class-history');
                setRecentActivity([]);
            } catch (err) {
                console.error("Failed to clear history:", err);
            }
        }
    };

    if (loading) return <div className="p-10 text-center animate-pulse font-black text-gray-300 tracking-widest uppercase">Securing Institutional Data...</div>;

    if (role !== 'admin') {
        const welcomeColor = role === 'hod' ? 'text-violet-600' : (role === 'faculty' ? 'text-indigo-600' : 'text-slate-600');
        return (
            <div className="p-6 sm:p-10 bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="text-center animate-in fade-in zoom-in duration-700">
                    <h1 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight">
                        Welcome back, <span className={welcomeColor}>{userName || role?.toUpperCase() || 'User'}</span>.
                    </h1>
                    <p className="mt-4 text-gray-500 font-medium text-sm sm:text-lg uppercase tracking-widest">Karpagam Academy of Higher Education</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-screen">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                        Welcome back, <span className="text-green-600">{userName || 'Admin'}</span>.
                    </h1>
                </div>
            </header>

            {/* Admin Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Rooms', value: stats.rooms || (stats.total_classrooms + stats.total_labs), icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5' },
                    { label: 'Today\'s Usage', value: stats.bookings, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                    { label: 'Active Classes', value: stats.active, icon: 'M13 10V3L4 14h7v7l9-11h-7z', color: 'text-red-500' },
                    { label: 'Conflicts', value: stats.conflict_alerts, icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: stats.conflict_alerts > 0 ? 'text-orange-500' : 'text-green-500' }
                ].map((item, idx) => (
                    <div key={idx} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center group hover:shadow-xl transition-all duration-500">
                        <div className="p-4 rounded-2xl mb-4 bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                        </div>
                        <p className={`text-4xl font-black ${item.color || 'text-gray-900'}`}>{item.value || 0}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{item.label}</p>
                    </div>
                ))}
            </div>

            {/* Recent Activity */}
            <div className="mt-12 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <h2 className="text-xl font-black text-gray-900">Recent Campus Activity</h2>
                    <div className="flex items-center space-x-3">
                        <button onClick={handleClearActivity} className="px-4 py-2 border-2 border-red-500 text-red-500 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-50 transition-colors">Clear History</button>
                        <button className="px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-colors">View All</button>
                    </div>
                </div>
                <div className="space-y-6">
                    {recentActivity.map((activity, index) => (
                        <div key={activity?.id} className="flex items-center space-x-4 border-b border-gray-50 pb-4 last:border-0">
                            <div className="h-12 w-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 text-xs font-black">
                                {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-gray-800 truncate">
                                    Room {rooms.find(r => r?.id === activity?.room_id)?.room_number || activity?.room_id} is {activity?.status === 'ACTIVE' ? 'occupied' : 'released'} by {activity?.faculty_name}
                                </p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">{getTimeAgo(activity?.start_time)}</p>
                            </div>
                        </div>
                    ))}
                    {recentActivity.length === 0 && (
                        <div className="py-20 text-center">
                            <p className="text-gray-400 font-medium italic">No recent institutional activities detected.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
