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
        const interval = setInterval(fetchRooms, 15000);
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
            alert('Class Started!');
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
                alert('Class Ended!');
            } else {
                fetchRooms();
            }
        } catch (err) {
            alert('Failed to end class');
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

    if (loading) return <div className="p-10 text-center animate-pulse font-black text-gray-400">LOADING CLASS ROOMS...</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-screen">
            <header className="mb-6 sm:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">Class Room</h1>
                    <p className="text-gray-600 font-medium text-sm sm:text-base">Real-time availability tracking.</p>
                </div>
                {role === 'admin' && (
                    <button
                        onClick={() => setShowAddRoomModal(true)}
                        className="w-full sm:w-64 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center space-x-4 group"
                    >
                        <div className="h-12 w-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</p>
                            <p className="text-sm font-black text-gray-800">Add New Room</p>
                        </div>
                    </button>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {Array.isArray(rooms) && rooms.map((room) => (
                    <div
                        key={room?.id}
                        className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col relative group overflow-hidden"
                    >
                        <div className={`h-1.5 w-full ${room?.status === 'IN_USE' ? 'bg-red-500' : 'bg-green-500'}`}></div>

                        <div className="p-8 flex flex-col flex-1">
                            <div className="flex justify-between items-start mb-6">
                                <div className="cursor-pointer group/link" onClick={() => navigate(`/rooms/${room?.id}`)}>
                                    <div className="flex items-center space-x-2 mb-1">
                                        <span className="text-2xl font-black text-gray-900 tracking-tight group-hover/link:text-indigo-600 transition-colors">{room?.room_number}</span>
                                        {room?.type === 'Lab' && <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">Lab</span>}
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                                        {room?.building} • FL {room?.floor}
                                    </p>
                                </div>
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-[0.15em] border-2 uppercase ${getStatusStyles(room?.status)}`}>
                                    {room?.status === 'IN_USE' ? '• Occupied' : '● Available'}
                                </span>
                            </div>

                            {room?.status === 'IN_USE' && activeSessions[room.id] ? (
                                <div className="mb-8 space-y-5 bg-indigo-50/50 p-6 rounded-[1.5rem] border border-indigo-100">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Faculty In-Charge</p>
                                    <p className="text-sm font-bold text-gray-800 truncate">{activeSessions[room.id]?.faculty_name}</p>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Subject</p>
                                    <p className="text-xs font-bold text-indigo-600 truncate">{activeSessions[room.id]?.subject}</p>
                                </div>
                            ) : (
                                <div className="space-y-4 mb-8">
                                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Department</p>
                                        <p className="text-[11px] font-bold text-gray-700">{room?.department}</p>
                                    </div>
                                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Capacity</p>
                                        <p className="text-[11px] font-bold text-gray-700">{room?.capacity} Students</p>
                                    </div>
                                </div>
                            )}

                            {role !== 'student' && (
                                <div className="mt-auto flex gap-3">
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
                                            className="flex-1 border-2 border-green-600 text-green-600 py-2.5 rounded-xl font-bold text-xs hover:bg-green-50 transition flex items-center justify-center space-x-2"
                                        >
                                            <span>START CLASS</span>
                                        </button>
                                    ) : (
                                        (role === 'admin' || activeSessions[room.id]?.faculty_user_id === currentUserId) ? (
                                            <button
                                                onClick={() => handleEndClass(room.id)}
                                                className="flex-1 border-2 border-red-600 text-red-600 py-2.5 rounded-xl font-bold text-xs hover:bg-red-50 transition flex items-center justify-center space-x-2"
                                            >
                                                <span>END CLASS</span>
                                            </button>
                                        ) : (
                                            <div className="flex-1 border-2 border-gray-200 text-gray-400 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center cursor-not-allowed">
                                                <span>OCCUPIED</span>
                                            </div>
                                        )
                                    )}
                                    {role === 'admin' && (
                                        <button
                                            onClick={() => handleDeleteRoom(room.id, room.room_number, room.status)}
                                            className="border-2 border-red-500 text-red-500 px-4 rounded-xl hover:bg-red-50 transition"
                                        >
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal: Start Class */}
            {showStartModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-indigo-600 p-6 text-white"><h2 className="text-2xl font-black uppercase tracking-tight">Start Class • {selectedRoom?.room_number}</h2></div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Faculty Name</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={sessionData.faculty_name} onChange={(e) => setSessionData({...sessionData, faculty_name: e.target.value})} required/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Faculty ID</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={sessionData.faculty_id_display} onChange={(e) => setSessionData({...sessionData, faculty_id_display: e.target.value})} required/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Department</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none" value={sessionData.department} onChange={(e) => setSessionData({...sessionData, department: e.target.value, subject: ''})} required><option value="">Select Dept</option>{Array.isArray(departments) && departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Subject</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none" value={sessionData.subject} onChange={(e) => setSessionData({...sessionData, subject: e.target.value})} required disabled={!sessionData.department}><option value="">Select Subject</option>{sessionData.department && Array.isArray(subjectMap[sessionData.department]) && subjectMap[sessionData.department].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Section</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none" value={sessionData.section} onChange={(e) => setSessionData({...sessionData, section: e.target.value})} required><option value="">Select Section</option>{['A','B','C','D','E','F'].map(s => <option key={s} value={s}>Section {s}</option>)}</select></div>
                            <div className="flex gap-4">
                                <div className="flex-1"><label className="text-[10px] font-black text-gray-400 uppercase">Date</label><input type="date" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={sessionData.date} onChange={(e) => setSessionData({...sessionData, date: e.target.value})} /></div>
                                <div className="flex-1"><label className="text-[10px] font-black text-gray-400 uppercase">Time</label><input type="time" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={sessionData.start_time_display} onChange={(e) => setSessionData({...sessionData, start_time_display: e.target.value})} /></div>
                            </div>
                        </div>
                        <div className="p-6 bg-white border-t flex gap-4">
                            <button onClick={() => setShowStartModal(false)} className="flex-1 border-2 border-gray-100 text-gray-400 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-50 transition">Cancel</button>
                            <button onClick={handleStartClass} className="flex-1 border-2 border-indigo-600 text-indigo-600 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition">Confirm & Start</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Add Room */}
            {showAddRoomModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[3rem] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-indigo-600 p-8 text-white"><h2 className="text-3xl font-black uppercase tracking-tight">Add Classroom</h2></div>
                        <form onSubmit={handleAddRoom} className="p-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Room Number</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={newRoomData.room_number} onChange={(e) => setNewRoomData({...newRoomData, room_number: e.target.value})} required placeholder="e.g. A-101"/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Room Name</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={newRoomData.room_name} onChange={(e) => setNewRoomData({...newRoomData, room_name: e.target.value})} placeholder="e.g. Computer Lab"/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Building</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={newRoomData.building} onChange={(e) => setNewRoomData({...newRoomData, building: e.target.value})} placeholder="Main Block"/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Type</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none" value={newRoomData.type} onChange={(e) => setNewRoomData({...newRoomData, type: e.target.value})} required><option value="Classroom">Classroom</option><option value="Lab">Lab</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Capacity</label><input type="number" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={newRoomData.capacity} onChange={(e) => setNewRoomData({...newRoomData, capacity: e.target.value})} required/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Department</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none" value={newRoomData.department} onChange={(e) => setNewRoomData({...newRoomData, department: e.target.value})} required>{Array.isArray(departments) && departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                            <div className="md:col-span-2 flex gap-4 mt-6">
                                <button type="button" onClick={() => setShowAddRoomModal(false)} className="flex-1 border-2 border-gray-100 text-gray-400 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-50 transition">Cancel</button>
                                <button type="submit" className="flex-1 border-2 border-indigo-600 text-indigo-600 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition">Create Room</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Rooms;
