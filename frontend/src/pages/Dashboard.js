import React, { useEffect, useState } from 'react';
import API from '../api';

const Dashboard = () => {
    const [stats, setStats] = useState({ rooms: 0, bookings: 0, active: 0 });
    const [notifications, setNotifications] = useState([]);
    const role = localStorage.getItem('role');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const roomsRes = await API.get('/rooms');
                const historyRes = await API.get('/class-history');
                const notifRes = await API.get('/notifications');

                setStats({
                    rooms: roomsRes.data.length,
                    bookings: historyRes.data.length,
                    active: roomsRes.data.filter(r => r.status === 'IN_USE').length
                });
                setNotifications(notifRes.data.filter(n => !n.is_read));
            } catch (err) {
                console.error(err);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    const markRead = async (id) => {
        try {
            await API.post(`/notifications/read/${id}`);
            setNotifications(notifications.filter(n => n.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="p-10 bg-gray-50 min-h-screen">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
                        Welcome back, <span className="text-indigo-600 capitalize">{role}</span>
                    </h1>
                    <p className="mt-2 text-lg text-gray-600 font-medium">Here's what's happening on campus today.</p>
                </div>
                <div className="flex space-x-3">
                    <button className="bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition">Export PDF</button>
                    <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-indigo-700 transition">View Schedule</button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                            </svg>
                        </div>
                        <span className="text-green-500 font-bold bg-green-50 px-2 py-1 rounded text-xs">+12%</span>
                    </div>
                    <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Total Rooms</h3>
                    <p className="text-4xl font-black text-gray-900 mt-2">{stats.rooms}</p>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition duration-300 transform hover:-translate-y-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-yellow-50 p-3 rounded-xl text-yellow-600">
                            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span className="text-yellow-500 font-bold bg-yellow-50 px-2 py-1 rounded text-xs">Active</span>
                    </div>
                    <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Bookings</h3>
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
                    <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Rooms in Use</h3>
                    <p className="text-4xl font-black text-gray-900 mt-2">{stats.active}</p>
                </div>
            </div>

            {notifications.length > 0 && (
                <div className="mt-8 space-y-4">
                    {notifications.map(n => (
                        <div key={n.id} className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl flex justify-between items-center animate-bounce">
                            <div className="flex items-center space-x-4">
                                <div className="bg-white/20 p-3 rounded-2xl">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-black text-lg">Room Available!</p>
                                    <p className="font-medium opacity-90">{n.message}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => markRead(n.id)}
                                className="bg-white text-indigo-600 px-6 py-2 rounded-xl font-black text-xs hover:bg-indigo-50 transition"
                            >
                                DISMISS
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-12">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-gray-900">Recent Activity</h2>
                        <button className="text-indigo-600 font-bold text-sm hover:underline">View All</button>
                    </div>
                    <div className="space-y-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center space-x-4 border-b border-gray-50 pb-4 last:border-0">
                                <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold">
                                    {i}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-800">Faculty booked Lab B-205</p>
                                    <p className="text-xs text-gray-500">10 minutes ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
