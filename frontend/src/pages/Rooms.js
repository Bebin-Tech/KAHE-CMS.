import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

const Rooms = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStartModal, setShowStartModal] = useState(false);
    const [showAddRoomModal, setShowAddRoomModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [activeSessions, setActiveSessions] = useState({});
    const role = localStorage.getItem('role');
    const currentUserId = parseInt(localStorage.getItem('user_id'));
    const [statusPopup, setStatusPopup] = useState({ show: false, message: '' });

    const triggerPopup = (message) => {
        setStatusPopup({ show: true, message });
        setTimeout(() => setStatusPopup({ show: false, message: '' }), 3000);
    };

    const [newRoomData, setNewRoomData] = useState({
        room_number: '',
        room_name: '',
        floor: '',
        building: '',
        type: 'Classroom',
        capacity: 60,
        department: 'Computer Science'
    });

    const [sessionData, setSessionData] = useState({
        faculty_name: '',
        faculty_id_display: '',
        department: '',
        subject: '',
        section: '',
        date: new Date().toISOString().split('T')[0],
        start_time_display: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        remarks: ''
    });

    useEffect(() => {
        let interval;
        if (showStartModal) {
            interval = setInterval(() => {
                const now = new Date();
                setSessionData(prev => ({
                    ...prev,
                    date: now.toISOString().split('T')[0],
                    start_time_display: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                }));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [showStartModal]);

    const departments = [
        "Languages",
        "Computer Science",
        "Mathematics",
        "General Education",
        "AI & DS (Artificial Intelligence and Data Science)"
    ];

    const subjectMap = {
        "Languages": ["Language-Tamil (III)", "Language-English (III)"],
        "Computer Science": ["Operating System", "Computer Networks", "Python for Data Science (Practical)"],
        "Mathematics": ["Operation Research"],
        "General Education": ["Community Engagement and Social Responsibility"],
        "AI & DS (Artificial Intelligence and Data Science)": ["Machine Learning", "Natural Language Processing", "Data Visualization"]
    };

    const fetchRooms = useCallback(async () => {
        try {
            const [roomsRes, sessionsRes] = await Promise.all([
                API.get('/rooms'),
                API.get('/active-sessions')
            ]);

            const rData = Array.isArray(roomsRes.data) ? roomsRes.data : [];
            setRooms(rData);

            const sessions = {};
            if (Array.isArray(sessionsRes.data)) {
                sessionsRes.data.forEach(s => {
                    if (s?.room_id) sessions[s.room_id] = s;
                });
            }
            setActiveSessions(sessions);
            setLoading(false);
        } catch (err) {
            console.error("Fetch error:", err);
            setLoading(false);
            if (err.response?.status === 401) {
                localStorage.clear();
                navigate('/login');
            }
        }
    }, [navigate]);

    useEffect(() => {
        fetchRooms();
        const interval = setInterval(fetchRooms, 5000); // 5s interval for real-time updates
        return () => clearInterval(interval);
    }, [fetchRooms]);

    const handleStartClass = async (e) => {
        if (e) e.preventDefault();
        try {
            await API.post('/start-class', {
                room_id: selectedRoom?.id,
                faculty_id_display: sessionData.faculty_id_display,
                faculty_name: sessionData.faculty_name,
                department: sessionData.department,
                subject: sessionData.subject,
                section: sessionData.section,
                date: sessionData.date,
                start_time_display: sessionData.start_time_display,
                remarks: sessionData.remarks
            });
            setShowStartModal(false);
            fetchRooms();
            triggerPopup('Class Started');
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to start class');
        }
    };

    const handleEndClass = async (roomId) => {
        try {
            const activeRes = await API.get(`/active-session/${roomId}`);
            if (activeRes.data && activeRes.data.id) {
                await API.post(`/end-class/${activeRes.data.id}`);
                fetchRooms();
                triggerPopup('Class Ended');
            } else {
                fetchRooms();
            }
        } catch (err) {
            const detail = err.response?.data?.detail;
            alert(typeof detail === 'string' ? detail : 'Failed to end class');
        }
    };

    const handleAddRoom = async (e) => {
        if (e) e.preventDefault();
        try {
            await API.post('/rooms', newRoomData);
            setShowAddRoomModal(false);
            setNewRoomData({
                room_number: '', room_name: '', floor: '', building: '',
                type: 'Classroom', capacity: 60, department: 'Computer Science'
            });
            fetchRooms();
            alert('Classroom Created!');
        } catch (err) {
            const detail = err.response?.data?.detail;
            alert(typeof detail === 'string' ? detail : 'Failed to add room');
        }
    };

    const handleDeleteRoom = async (id, roomNumber, status) => {
        if (status === 'IN_USE') {
            alert('Cannot delete room while a class is in progress.');
            return;
        }
        if (window.confirm(`Delete Room ${roomNumber}?`)) {
            try {
                await API.delete(`/rooms/${id}`);
                fetchRooms();
                alert('Room deleted successfully.');
            } catch (err) {
                alert('Failed to delete room');
            }
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'AVAILABLE': return 'bg-green-100 text-green-700 border-green-200';
            case 'IN_USE': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const isStale = (startTime) => {
        if (!startTime) return false;
        const start = new Date(startTime);
        const now = new Date();
        const diffMs = now - start;
        return diffMs > 7200000; // 2 Hours in milliseconds
    };

    const calculateDuration = (startTime) => {
        if (!startTime) return '0m';
        const start = new Date(startTime);
        const now = new Date();
        const diffMs = now - start;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `${diffMins}m`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
    };

    if (loading) return <div className="p-10 text-center animate-pulse font-black text-slate-300 tracking-widest uppercase">Initializing Intelligence...</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-[#f8fafc] min-h-screen">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tightest uppercase italic">Classroom Module</h1>
                    <div className="flex items-center space-x-2 mt-1">
                        <span className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[9px]">Live Facility Intelligence</p>
                    </div>
                </div>
                {role === 'admin' && (
                    <button
                        onClick={() => setShowAddRoomModal(true)}
                        className="bg-white px-8 py-4 rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-600 transition-all group flex items-center space-x-3"
                    >
                        <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Register Space</span>
                    </button>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {Array.isArray(rooms) && rooms.map((room) => (
                    <div
                        key={room?.id}
                        className="bg-[#1e1e1e] rounded-[1.25rem] shadow-2xl overflow-hidden flex flex-col group transition-all duration-500 hover:shadow-indigo-500/10"
                    >
                        {/* CARD IMAGE HEADER (Clickable to History) */}
                        <div className="h-48 w-full relative overflow-hidden cursor-pointer" onClick={() => navigate(`/rooms/${room?.id}`)}>
                            <img
                                src={room?.type === 'Lab'
                                    ? "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&q=80&w=800"
                                    : "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=800"
                                }
                                alt="Classroom"
                                className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] via-transparent to-transparent opacity-60"></div>
                            <div className="absolute top-4 right-4">
                                <span className={`px-3 py-1 rounded-full text-[8px] font-black tracking-widest border uppercase backdrop-blur-md ${
                                    room?.status === 'IN_USE'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                }`}>
                                    {room?.status === 'IN_USE' ? '• Occupied' : '● Available'}
                                </span>
                            </div>
                            {room?.status === 'IN_USE' && (
                                <div className="absolute bottom-4 left-4 flex items-center space-x-2">
                                    <div className={`h-1.5 w-1.5 rounded-full animate-ping ${isStale(activeSessions[room.id]?.start_time) ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${isStale(activeSessions[room.id]?.start_time) ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                                        {isStale(activeSessions[room.id]?.start_time) ? 'STALE SESSION: ' : 'Running for '}
                                        {calculateDuration(activeSessions[room.id]?.start_time)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* CARD CONTENT */}
                        <div className="p-6 flex flex-col flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-2xl font-black text-white tracking-tight leading-none group-hover:text-indigo-400 transition-colors uppercase cursor-pointer" onClick={() => navigate(`/rooms/${room?.id}`)}>
                                    {room?.room_number}
                                </h2>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{room?.building}</p>
                            </div>

                            <p className="text-slate-400 text-[11px] font-medium leading-relaxed mb-6 line-clamp-2">
                                {room?.room_name || 'Standard Instructional Space'} situated at Floor {room?.floor || '1'}. Optimized for {room?.capacity || '60'} students.
                            </p>

                            {room?.status === 'IN_USE' && activeSessions[room.id] ? (
                                <div className="mb-6 space-y-3 bg-white/5 p-4 rounded-xl border border-white/10">
                                    <div className="flex justify-between items-center">
                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Faculty</p>
                                        <p className="text-[10px] font-bold text-white uppercase">{activeSessions[room.id]?.faculty_name}</p>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Subject</p>
                                        <p className="text-[10px] font-bold text-white truncate max-w-[120px]">{activeSessions[room.id]?.subject}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Type</p>
                                        <p className="text-[9px] font-bold text-slate-300 uppercase">{room?.type}</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Capacity</p>
                                        <p className="text-[9px] font-bold text-slate-300 uppercase">{room?.capacity} Seats</p>
                                    </div>
                                </div>
                            )}

                            {/* CARD ACTIONS */}
                            <div className="mt-auto flex items-center justify-between pt-6 border-t border-white/5 gap-3">
                                <div className="flex-1">
                                    {room?.status === 'AVAILABLE' ? (
                                        <button
                                            onClick={() => {
                                                setSelectedRoom(room);
                                                setSessionData({
                                                    ...sessionData,
                                                    faculty_name: localStorage.getItem('name') || '',
                                                    faculty_id_display: localStorage.getItem('user_id') || '',
                                                    department: room?.department || '',
                                                    date: new Date().toISOString().split('T')[0],
                                                    start_time_display: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                                                });
                                                setShowStartModal(true);
                                            }}
                                            className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                                        >
                                            Start Class
                                        </button>
                                    ) : (
                                        // ONLY the faculty who started the session (currentUserId) or an ADMIN can see the End Session button
                                        (role?.toLowerCase() === 'admin' ||
                                         activeSessions[room.id]?.faculty_user_id === currentUserId) ? (
                                            <button
                                                onClick={() => handleEndClass(room.id)}
                                                className="w-full bg-rose-600 text-white py-3.5 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] hover:bg-rose-700 transition-all shadow-lg shadow-rose-900/20 active:scale-95"
                                            >
                                                End Session
                                            </button>
                                        ) : (
                                            <div className="w-full bg-slate-800 text-slate-500 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] text-center opacity-50">
                                                In Progress
                                            </div>
                                        )
                                    )}
                                </div>
                                {role === 'admin' && (
                                    <button
                                        onClick={() => handleDeleteRoom(room.id, room.room_number, room.status)}
                                        className="h-11 w-11 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all duration-300"
                                    >
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal: Start Class */}
            {showStartModal && (
                <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-[#1e1e1e] rounded-[2.5rem] w-full max-w-2xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col border border-white/10">
                        <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                            <h2 className="text-3xl font-black uppercase tracking-tight relative z-10">Start Session</h2>
                            <p className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.3em] mt-1 relative z-10">Activating {selectedRoom?.room_number}</p>
                        </div>
                        <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Faculty Name</label>
                                <input className="w-full p-5 bg-white/5 border-2 border-transparent focus:border-indigo-600 rounded-2xl font-bold text-white outline-none transition-all" value={sessionData.faculty_name} onChange={(e) => setSessionData({...sessionData, faculty_name: e.target.value})} required/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identity ID</label>
                                <input className="w-full p-5 bg-white/5 border-2 border-transparent focus:border-indigo-600 rounded-2xl font-bold text-white outline-none transition-all" value={sessionData.faculty_id_display} onChange={(e) => setSessionData({...sessionData, faculty_id_display: e.target.value})} required/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Institutional Dept</label>
                                <select className="w-full p-5 bg-[#2a2a2a] border-2 border-transparent rounded-2xl font-bold text-white outline-none appearance-none" value={sessionData.department} onChange={(e) => setSessionData({...sessionData, department: e.target.value, subject: ''})} required>
                                    <option value="">Select Dept</option>
                                    {Array.isArray(departments) && departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Academic Subject</label>
                                <select className="w-full p-5 bg-[#2a2a2a] border-2 border-transparent rounded-2xl font-bold text-white outline-none appearance-none" value={sessionData.subject} onChange={(e) => setSessionData({...sessionData, subject: e.target.value})} required disabled={!sessionData.department}>
                                    <option value="">Select Subject</option>
                                    {sessionData.department && Array.isArray(subjectMap[sessionData.department]) && subjectMap[sessionData.department].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Section</label>
                                <select className="w-full p-5 bg-[#2a2a2a] border-2 border-transparent rounded-2xl font-bold text-white outline-none appearance-none" value={sessionData.section} onChange={(e) => setSessionData({...sessionData, section: e.target.value})} required>
                                    <option value="">Select Section</option>
                                    {['A','B','C','D','E','F'].map(s => <option key={s} value={s}>Section {s}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Timestamp</label>
                                    <input type="time" className="w-full p-5 bg-white/5 border-none rounded-2xl font-bold text-white outline-none" value={sessionData.start_time_display} onChange={(e) => setSessionData({...sessionData, start_time_display: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-[#1a1a1a] border-t border-white/5 flex gap-4">
                            <button onClick={() => setShowStartModal(false)} className="flex-1 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] text-slate-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                            <button onClick={handleStartClass} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all">Activate Space</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Add Room */}
            {showAddRoomModal && (
                <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in zoom-in duration-300">
                    <div className="bg-[#1e1e1e] rounded-[3rem] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col border border-white/10">
                        <div className="bg-slate-900 p-10 text-white border-b border-white/5">
                            <h2 className="text-4xl font-black uppercase tracking-tightest italic">Register Space</h2>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-1">Expanding Institutional Infrastructure</p>
                        </div>
                        <form onSubmit={handleAddRoom} className="p-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Room Index</label><input className="w-full p-5 bg-white/5 border-2 border-transparent focus:border-indigo-600 rounded-2xl font-bold text-white outline-none transition-all" value={newRoomData.room_number} onChange={(e) => setNewRoomData({...newRoomData, room_number: e.target.value})} required placeholder="e.g. A-101"/></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Functional Name</label><input className="w-full p-5 bg-white/5 border-2 border-transparent focus:border-indigo-600 rounded-2xl font-bold text-white outline-none transition-all" value={newRoomData.room_name} onChange={(e) => setNewRoomData({...newRoomData, room_name: e.target.value})} placeholder="e.g. AI Lab"/></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Wing / Block</label><input className="w-full p-5 bg-white/5 border-2 border-transparent focus:border-indigo-600 rounded-2xl font-bold text-white outline-none transition-all" value={newRoomData.building} onChange={(e) => setNewRoomData({...newRoomData, building: e.target.value})} placeholder="Main Block"/></div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Facility Type</label>
                                <select className="w-full p-5 bg-[#2a2a2a] border-2 border-transparent rounded-2xl font-bold text-white outline-none appearance-none" value={newRoomData.type} onChange={(e) => setNewRoomData({...newRoomData, type: e.target.value})} required>
                                    <option value="Classroom">Classroom</option>
                                    <option value="Lab">Lab</option>
                                </select>
                            </div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Occupancy Limit</label><input type="number" className="w-full p-5 bg-white/5 border-2 border-transparent focus:border-indigo-600 rounded-2xl font-bold text-white outline-none transition-all" value={newRoomData.capacity} onChange={(e) => setNewRoomData({...newRoomData, capacity: e.target.value})} required/></div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Department</label>
                                <select className="w-full p-5 bg-[#2a2a2a] border-2 border-transparent rounded-2xl font-bold text-white outline-none appearance-none" value={newRoomData.department} onChange={(e) => setNewRoomData({...newRoomData, department: e.target.value})} required>
                                    {Array.isArray(departments) && departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2 flex gap-6 mt-10">
                                <button type="button" onClick={() => setShowAddRoomModal(false)} className="flex-1 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] text-slate-400 hover:text-white hover:bg-white/5 transition-all">Dismiss</button>
                                <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-900/40 hover:scale-[1.02] active:scale-95 transition-all">Finalize Registration</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Status Popup */}
            {statusPopup.show && (
                <div className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-white/20 px-10 py-5 rounded-[2rem] shadow-2xl animate-in zoom-in duration-300">
                        <div className="flex items-center space-x-4">
                            <div className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/40">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-white font-black text-xl tracking-tightest uppercase italic">{statusPopup.message}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Rooms;
