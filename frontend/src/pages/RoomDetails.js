import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api';

const RoomDetails = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [room, setRoom] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRoomAndHistory = useCallback(async () => {
        try {
            const [roomsRes, historyRes] = await Promise.all([
                API.get('/rooms'),
                API.get(`/room-history/${roomId}`)
            ]);

            const currentRoom = roomsRes.data.find(r => r.id === parseInt(roomId));
            setRoom(currentRoom);
            setHistory(historyRes.data || []);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    }, [roomId]);

    useEffect(() => {
        fetchRoomAndHistory();
    }, [fetchRoomAndHistory]);

    const getTimeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    const getDuration = (start, end) => {
        if (!start || !end) return null;
        const s = new Date(start);
        const e = new Date(end);
        const diff = Math.floor((e - s) / 60000);
        return `${diff} mins`;
    };

    if (loading) return <div className="p-4 sm:p-10 text-center font-black text-slate-300 animate-pulse uppercase tracking-[0.3em]">Establishing Secure Connection...</div>;
    if (!room) return <div className="p-4 sm:p-10 text-center text-rose-500 font-black uppercase italic">Room Identity Not Found</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-[#f8fafc] min-h-screen">
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => navigate('/rooms')}
                    className="mb-8 flex items-center bg-white border-2 border-slate-200 text-slate-600 font-black px-6 py-3 rounded-2xl transition-all hover:border-indigo-600 hover:text-indigo-600 shadow-sm text-[10px] uppercase tracking-widest"
                >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Institutional Directory
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Left: Room Info Card */}
                    <div className="lg:col-span-1">
                        <div className="bg-[#1e1e1e] p-10 rounded-[2.5rem] shadow-2xl border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-600/20 transition-all duration-700"></div>

                            <div className={`h-24 w-24 rounded-[2rem] flex items-center justify-center text-white text-4xl font-black mb-8 shadow-2xl relative z-10 ${
                                room.status === 'IN_USE' ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}>
                                {room.room_number.charAt(0)}
                            </div>

                            <h1 className="text-4xl font-black text-white tracking-tightest mb-2 relative z-10 uppercase italic">{room.room_number}</h1>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[9px] mb-8 relative z-10">{room.type} • {room.department}</p>

                            <div className="space-y-5 pt-8 border-t border-white/5 relative z-10">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-black text-[9px] uppercase tracking-widest">Global Status</span>
                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase border ${
                                        room.status === 'IN_USE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    }`}>{room.status}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-black text-[9px] uppercase tracking-widest">Building</span>
                                    <span className="font-bold text-slate-300 uppercase">{room.building || 'Main Block'}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-black text-[9px] uppercase tracking-widest">Floor Level</span>
                                    <span className="font-bold text-slate-300">Level {room.floor || 'G'}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-black text-[9px] uppercase tracking-widest">Occupancy</span>
                                    <span className="font-bold text-slate-300">{room.capacity} Students</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: History Timeline */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                            <div className="p-10 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tightest uppercase italic">Session Audit Log</h2>
                                <p className="text-slate-400 text-[10px] font-bold mt-1 uppercase tracking-[0.4em]">Tracking Institutional Presence</p>
                            </div>

                            <div className="flex-1">
                                {history.length > 0 ? (
                                    <div className="divide-y divide-slate-100">
                                        {history.map((session) => (
                                            <div key={session.id} className="p-10 hover:bg-slate-50 transition-all duration-300 group">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-start space-x-6">
                                                        <div className="h-14 w-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-lg group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                                                            {session.faculty_name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center space-x-3 mb-1">
                                                                <p className="font-black text-slate-900 uppercase text-lg leading-none">{session.subject}</p>
                                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black rounded uppercase tracking-tighter border border-slate-200">Sec {session.section}</span>
                                                            </div>
                                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Led by {session.faculty_name}</p>

                                                            <div className="flex items-center space-x-4 mt-4">
                                                                <div className="bg-indigo-50 px-3 py-1.5 rounded-xl flex items-center space-x-2">
                                                                    <div className="h-1 w-1 bg-indigo-400 rounded-full"></div>
                                                                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">
                                                                        {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        {session.end_time ? ` — ${new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (Currently Active)'}
                                                                    </p>
                                                                </div>
                                                                {session.end_time && (
                                                                    <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Duration: {getDuration(session.start_time, session.end_time)}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-1">{getTimeAgo(session.start_time)}</span>
                                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${session.status === 'ACTIVE' ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
                                                            {session.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-20 text-center flex flex-col items-center justify-center h-full">
                                        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                            <svg className="h-8 w-8 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] italic">No prior institutional records found for this space.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoomDetails;
