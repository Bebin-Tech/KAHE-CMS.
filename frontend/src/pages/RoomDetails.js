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

    if (loading) return <div className="p-4 sm:p-10 text-center font-bold text-gray-500 animate-pulse">LOADING DETAILS...</div>;
    if (!room) return <div className="p-4 sm:p-10 text-center text-red-500 font-bold">Room not found</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => navigate('/rooms')}
                    className="mb-6 sm:mb-8 flex items-center border-2 border-indigo-600 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-xl transition text-sm"
                >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    BACK TO DIRECTORY
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Room Info */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                            <div className={`h-20 w-20 rounded-3xl flex items-center justify-center text-white text-3xl font-black mb-6 shadow-lg ${
                                room.status === 'IN_USE' ? 'bg-red-500' : 'bg-green-500'
                            }`}>
                                {room.room_number.charAt(0)}
                            </div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">Room {room.room_number}</h1>
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-6">{room.type} • {room.department}</p>

                            <div className="space-y-4 pt-6 border-t border-gray-50">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 font-bold text-xs">STATUS</span>
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest ${
                                        room.status === 'IN_USE' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                                    }`}>{room.status}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 font-bold text-xs">BUILDING</span>
                                    <span className="font-bold text-gray-700">{room.building || 'Main Block'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 font-bold text-xs">FLOOR</span>
                                    <span className="font-bold text-gray-700">{room.floor || 'G'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 font-bold text-xs">CAPACITY</span>
                                    <span className="font-bold text-gray-700">{room.capacity} Seats</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: History */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-8 border-b border-gray-50">
                                <h2 className="text-xl font-black text-gray-800">Usage History</h2>
                                <p className="text-gray-400 text-xs font-bold mt-1 uppercase tracking-widest">Recent sessions in this room</p>
                            </div>

                            <div className="p-0">
                                {history.length > 0 ? (
                                    <div className="divide-y divide-gray-50">
                                        {history.map((session) => (
                                            <div key={session.id} className="p-8 hover:bg-gray-50/50 transition group">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-start space-x-4">
                                                        <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-black text-xs group-hover:scale-110 transition">
                                                            {session.faculty_name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-gray-800 leading-tight">{session.subject}</p>
                                                            <p className="text-xs font-bold text-gray-500 mt-1">{session.faculty_name} • Section {session.section}</p>
                                                            <p className="text-[10px] font-bold text-indigo-400 mt-2 uppercase tracking-tighter">
                                                                {new Date(session.start_time).toLocaleTimeString()} - {session.end_time ? new Date(session.end_time).toLocaleTimeString() : 'Active'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{getTimeAgo(session.start_time)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-20 text-center">
                                        <p className="text-gray-400 font-medium italic">No usage history found for this classroom.</p>
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
