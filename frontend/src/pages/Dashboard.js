import React, { useEffect, useState } from 'react';
import API from '../api';

const Dashboard = () => {
    const [stats, setStats] = useState({ rooms: 0, bookings: 0, active: 0 });
    const [recentActivity, setRecentActivity] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const role = localStorage.getItem('role')?.toLowerCase();
    const userName = localStorage.getItem('name'); // Assuming name is stored in localStorage

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const roomsRes = await API.get('/rooms');
                const historyRes = await API.get('/class-history');
                const notifRes = await API.get('/notifications');

                setRooms(roomsRes.data || []);
                setStats({
                    rooms: roomsRes.data.length,
                    bookings: historyRes.data.length,
                    active: roomsRes.data.filter(r => r.status === 'IN_USE').length
                });
                setRecentActivity(historyRes.data.slice(0, 5)); // Get last 5 activities
                setNotifications(notifRes.data.filter(n => !n.is_read));
            } catch (err) {
                console.error(err);
            }
        };

        if (role === 'admin') {
            fetchStats();
            const interval = setInterval(fetchStats, 30000); // Optimized: 30 seconds for dashboard stats
            return () => clearInterval(interval);
        }
    }, [role]);

    const getTimeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    const markRead = async (id) => {
        try {
            await API.post(`/notifications/read/${id}`);
            setNotifications(notifications.filter(n => n.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    // --- RENDER HOD DASHBOARD ---
    if (role === 'hod') {
        return (
            <div className="p-6 sm:p-10 bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="text-center animate-in fade-in zoom-in duration-700">
                    <h1 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight">
                        Welcome back, <span className="text-violet-600">{userName || 'HOD'}</span>.
                    </h1>
                    <p className="mt-4 text-gray-500 font-medium text-sm sm:text-lg uppercase tracking-widest">Karpagam Academy of Higher Education</p>
                </div>
            </div>
        );
    }

    // --- RENDER FACULTY DASHBOARD (Landing Page) ---
    if (role === 'faculty') {
        return (
            <div className="p-6 sm:p-10 bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="text-center animate-in fade-in zoom-in duration-700">
                    <h1 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight">
                        Welcome back, <span className="text-indigo-600">{userName || 'Faculty'}</span>.
                    </h1>
                    <p className="mt-4 text-gray-500 font-medium text-sm sm:text-lg uppercase tracking-widest">Karpagam Academy of Higher Education</p>
                </div>
            </div>
        );
    }

    // --- RENDER DEFAULT DASHBOARD (For Students/Staff/etc) ---
    if (role !== 'admin') {
        return (
            <div className="p-6 sm:p-10 bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="text-center animate-in fade-in zoom-in duration-700">
                    <h1 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight">
                        Welcome back, <span className="text-slate-600">{userName || 'User'}</span>.
                    </h1>
                    <p className="mt-4 text-gray-500 font-medium text-sm sm:text-lg uppercase tracking-widest">Karpagam Academy of Higher Education</p>
                    <p className="mt-2 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Campus Management System</p>
                </div>
            </div>
        );
    }

    // --- RENDER ADMIN DASHBOARD (FULL) ---
    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-screen">
            <header className="mb-6 sm:mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                        Welcome back, <span className="text-green-600">{userName || 'Admin'}</span>.
                    </h1>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Admin Stats Cards */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                            </svg>
                        </div>
                        <span className="text-green-500 font-bold bg-green-50 px-2 py-1 rounded text-xs">+12%</span>
                    </div>
                    <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Total Class Rooms</h3>
                    <p className="text-4xl font-black text-gray-900 mt-2">{stats.rooms}</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-yellow-50 p-3 rounded-xl text-yellow-600">
                            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <span className="text-yellow-500 font-bold bg-yellow-50 px-2 py-1 rounded text-xs">Live</span>
                    </div>
                    <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Today's Usage</h3>
                    <p className="text-4xl font-black text-gray-900 mt-2">{stats.bookings}</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-red-50 p-3 rounded-xl text-red-600">
                            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded text-xs">Live</span>
                    </div>
                    <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Class Rooms in Use</h3>
                    <p className="text-4xl font-black text-gray-900 mt-2">{stats.active}</p>
                </div>
            </div>

            {/* Notifications */}
            {notifications.length > 0 && (
                <div className="mt-8 space-y-4">
                    {notifications.map(n => (
                        <div key={n.id} className="bg-indigo-600 text-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-bounce">
                            <div className="flex items-center space-x-4">
                                <div className="bg-white/20 p-3 rounded-2xl hidden sm:block">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-black text-base sm:text-lg">Class Room Available!</p>
                                    <p className="font-medium text-sm opacity-90">{n.message}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => markRead(n.id)}
                                className="w-full sm:w-auto bg-white text-indigo-600 px-6 py-2 rounded-xl font-black text-xs hover:bg-indigo-50 transition"
                            >
                                DISMISS
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Recent Activity Section */}
            <div className="mt-12">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h2 className="text-xl font-black text-gray-900">Recent Activity</h2>
                        <button className="text-indigo-600 font-bold text-sm hover:underline text-left">View All</button>
                    </div>
                    <div className="space-y-6">
                        {recentActivity.map((activity, index) => (
                            <div key={activity.id} className="flex items-center space-x-4 border-b border-gray-50 pb-4 last:border-0">
                                <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold">
                                    {index + 1}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-800">
                                        Room {rooms.find(r => r.id === activity.room_id)?.room_number || activity.room_id} is {activity.status === 'ACTIVE' ? 'currently occupied' : 'now available'} by {activity.faculty_name}
                                    </p>
                                    <p className="text-xs text-gray-500">{getTimeAgo(activity.start_time)}</p>
                                </div>
                            </div>
                        ))}
                        {recentActivity.length === 0 && (
                            <p className="text-center py-10 text-gray-400 font-medium italic">No recent campus activity detected.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
