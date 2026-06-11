import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

const Rooms = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStartModal, setShowStartModal] = useState(false);
    const [showAddRoomModal, setShowAddRoomModal] = useState(false);
    const [showEditRoomModal, setShowEditRoomModal] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [successMessage, setSuccessMessage] = useState({ title: '', sub: '' });
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

    const [editRoomData, setEditRoomData] = useState({
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

            setRooms(roomsRes.data || []);

            const sessions = {};
            if (sessionsRes.data) {
                sessionsRes.data.forEach(s => {
                    sessions[s.room_id] = s;
                });
            }
            setActiveSessions(sessions);
            setLoading(false);
        } catch (err) {
            console.error("Backend unreachable:", err);
            setLoading(false);
            if (err.response?.status === 401) {
                alert("Your session has expired. Please login again.");
                localStorage.clear();
                navigate('/login');
                window.location.reload();
            }
        }
    }, [navigate]);

    useEffect(() => {
        fetchRooms();
        const interval = setInterval(fetchRooms, 15000); // Optimized: 15 seconds for live room status
        return () => clearInterval(interval);
    }, [fetchRooms]);

    const handleStartClass = async (e) => {
        if (e) e.preventDefault();
        try {
            await API.post('/start-class', {
                room_id: selectedRoom.id,
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
            setSuccessMessage({ title: 'Class Started!', sub: 'Session is now live and active' });
            setShowSuccessPopup(true);
            setTimeout(() => setShowSuccessPopup(false), 3000);
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
                setSuccessMessage({ title: 'Class Ended!', sub: 'Session completed successfully' });
                setShowSuccessPopup(true);
                setTimeout(() => setShowSuccessPopup(false), 3000);
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
            console.log("Adding room with data:", newRoomData);
            const res = await API.post('/rooms', newRoomData);
            console.log("Add room response:", res.data);
            setShowAddRoomModal(false);
            setNewRoomData({
                room_number: '', room_name: '', floor: '', building: '',
                type: 'Classroom', capacity: 60, department: 'Computer Science'
            });
            fetchRooms();
            setSuccessMessage({ title: 'Classroom Created!', sub: 'Successfully saved to directory' });
            setShowSuccessPopup(true);
            setTimeout(() => setShowSuccessPopup(false), 3000);
        } catch (err) {
            console.error("Add room full error details:", err);
            const detail = err.response?.data?.detail;
            let errorMsg = 'Failed to add room. Please try logging out and back in.';

            if (typeof detail === 'string') {
                errorMsg = detail;
            } else if (Array.isArray(detail)) {
                errorMsg = detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join('\n');
            } else if (err.response?.status === 401) {
                errorMsg = "Unauthorized: Please logout and login again.";
            } else if (err.response?.status === 403) {
                errorMsg = "Access Denied: You must be an admin to add rooms.";
            }

            alert(errorMsg);
        }
    };

    const handleUpdateRoom = async (e) => {
        if (e) e.preventDefault();
        try {
            await API.put(`/rooms/${selectedRoom.id}`, editRoomData);
            setShowEditRoomModal(false);
            fetchRooms();
            alert('Room updated successfully!');
        } catch (err) {
            console.error("Update room error:", err);
            const detail = err.response?.data?.detail;
            alert(typeof detail === 'string' ? detail : 'Failed to update room');
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
                console.error("Delete room error:", err);
                const detail = err.response?.data?.detail;
                alert(typeof detail === 'string' ? detail : 'Failed to delete room');
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

    if (loading) return <div className="p-4 sm:p-10 text-center font-bold text-gray-500 tracking-widest uppercase animate-pulse">Loading Class Rooms...</div>;

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
                        className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition"
                    >
                        + Add New Room
                    </button>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {rooms.map((room) => (
                    <div
                        key={room.id}
                        className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col relative group overflow-hidden"
                    >
                        {/* Top Accent Bar */}
                        <div className={`h-1.5 w-full ${room.status === 'IN_USE' ? 'bg-red-500' : 'bg-green-500'}`}></div>

                        <div className="p-8 flex flex-col flex-1">
                            {role === 'admin' && (
                                <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button
                                        onClick={() => { setSelectedRoom(room); setEditRoomData(room); setShowEditRoomModal(true); }}
                                        className="bg-white/90 backdrop-blur-md text-indigo-600 p-2.5 rounded-xl shadow-lg border border-indigo-50 hover:bg-indigo-600 hover:text-white transition-all"
                                        title="Edit Room"
                                    >
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-6">
                                <div className="cursor-pointer group/link" onClick={() => navigate(`/rooms/${room.id}`)}>
                                    <div className="flex items-center space-x-2 mb-1">
                                        <span className="text-2xl font-black text-gray-900 tracking-tight group-hover/link:text-indigo-600 transition-colors">{room.room_number}</span>
                                        {room.type === 'Lab' && <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">Lab</span>}
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                                        <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/></svg>
                                        {room.building} • FL {room.floor}
                                    </p>
                                </div>
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-[0.15em] border-2 uppercase ${getStatusStyles(room.status)}`}>
                                    {room.status === 'IN_USE' ? '• Occupied' : '● Available'}
                                </span>
                            </div>

                            {room.status === 'IN_USE' && activeSessions[room.id] ? (
                                <div className="mb-8 space-y-5 bg-indigo-50/50 p-6 rounded-[1.5rem] border border-indigo-100 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className="flex items-start space-x-4">
                                        <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-200">
                                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Faculty In-Charge</p>
                                            <p className="text-sm font-bold text-gray-800 truncate">{activeSessions[room.id].faculty_name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start space-x-4">
                                        <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-indigo-100">
                                            <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Subject & Section</p>
                                            <p className="text-xs font-bold text-indigo-600 truncate leading-snug">{activeSessions[room.id].subject}</p>
                                            <p className="text-[9px] text-gray-400 font-bold mt-0.5">Section {activeSessions[room.id].section} • {activeSessions[room.id].start_time_display}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center text-gray-500 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 transition-colors group-hover:bg-indigo-50/30 group-hover:border-indigo-100">
                                        <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center mr-3 shadow-sm border border-gray-100">
                                            <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Department</p>
                                            <p className="text-[11px] font-bold text-gray-700">{room.department}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center text-gray-500 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 transition-colors group-hover:bg-indigo-50/30 group-hover:border-indigo-100">
                                        <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center mr-3 shadow-sm border border-gray-100">
                                            <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857" /></svg>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Seating Capacity</p>
                                            <p className="text-[11px] font-bold text-gray-700">{room.capacity} Students Max</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {role !== 'student' && (
                                <div className="mt-auto flex gap-3">
                                    {room.status === 'AVAILABLE' ? (
                                        <button
                                            onClick={() => {
                                                setSelectedRoom(room);
                                                setSessionData({
                                                    ...sessionData,
                                                    faculty_name: localStorage.getItem('name') || '',
                                                    faculty_id_display: localStorage.getItem('user_id') || '',
                                                    department: room.department || '',
                                                    date: new Date().toISOString().split('T')[0],
                                                    start_time_display: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                                                });
                                                setShowStartModal(true);
                                            }}
                                            className="flex-1 bg-green-600 text-white py-3.5 rounded-2xl font-black text-xs hover:bg-green-700 transition shadow-lg shadow-green-100 active:scale-[0.98] flex items-center justify-center space-x-2"
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                                            <span>START CLASS</span>
                                        </button>
                                    ) : (
                                        // Only show END CLASS if user is the faculty who started it OR is an admin
                                        (role === 'admin' || activeSessions[room.id]?.faculty_user_id === currentUserId) ? (
                                            <button
                                                onClick={() => handleEndClass(room.id)}
                                                className="flex-1 bg-red-600 text-white py-3.5 rounded-2xl font-black text-xs hover:bg-red-700 transition shadow-lg shadow-red-100 active:scale-[0.98] flex items-center justify-center space-x-2"
                                            >
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                <span>END CLASS</span>
                                            </button>
                                        ) : (
                                            <div className="flex-1 bg-gray-100 text-gray-400 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center cursor-not-allowed">
                                                <span>OCCUPIED</span>
                                            </div>
                                        )
                                    )}
                                    {role === 'admin' && (
                                        <button
                                            onClick={() => handleDeleteRoom(room.id, room.room_number, room.status)}
                                            className="bg-gray-100 text-red-500 px-4 rounded-2xl hover:bg-red-50 transition border border-gray-200 active:scale-95 group/del"
                                            title="Delete Classroom"
                                        >
                                            <svg className="h-5 w-5 group-hover/del:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
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
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 p-6 text-white"><h2 className="text-2xl font-black uppercase">Start Class • {selectedRoom?.room_number}</h2></div>
                            <div className="p-6 sm:p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Faculty Name</label><input className="w-full p-3 sm:p-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-500 text-sm" value={sessionData.faculty_name} onChange={(e) => setSessionData({...sessionData, faculty_name: e.target.value})} required/></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Faculty ID</label><input className="w-full p-3 sm:p-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-500 text-sm" value={sessionData.faculty_id_display} onChange={(e) => setSessionData({...sessionData, faculty_id_display: e.target.value})} required/></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Department</label><select className="w-full p-3 sm:p-4 bg-gray-50 rounded-2xl font-bold outline-none text-sm" value={sessionData.department} onChange={(e) => setSessionData({...sessionData, department: e.target.value, subject: ''})} required><option value="">Select Department</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Subject</label><select className="w-full p-3 sm:p-4 bg-gray-50 rounded-2xl font-bold outline-none text-sm" value={sessionData.subject} onChange={(e) => setSessionData({...sessionData, subject: e.target.value})} required disabled={!sessionData.department}><option value="">Select Subject</option>{sessionData.department && subjectMap[sessionData.department]?.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Section</label><select className="w-full p-3 sm:p-4 bg-gray-50 rounded-2xl font-bold outline-none text-sm" value={sessionData.section} onChange={(e) => setSessionData({...sessionData, section: e.target.value})} required><option value="">Select Section</option>{['A','B','C','D','E','F'].map(s => <option key={s} value={s}>Section {s}</option>)}</select></div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase">Date</label>
                                        <input
                                            type="date"
                                            className="w-full p-3 sm:p-4 bg-gray-50 rounded-2xl font-bold outline-none text-sm focus:ring-2 ring-indigo-500"
                                            value={sessionData.date}
                                            onChange={(e) => setSessionData({...sessionData, date: e.target.value})}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase">Time</label>
                                        <input
                                            type="time"
                                            className="w-full p-3 sm:p-4 bg-gray-50 rounded-2xl font-bold outline-none text-sm focus:ring-2 ring-indigo-500"
                                            value={sessionData.start_time_display}
                                            onChange={(e) => setSessionData({...sessionData, start_time_display: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 sm:p-6 bg-white border-t flex flex-col sm:flex-row gap-3 sm:gap-4"><button onClick={() => setShowStartModal(false)} className="flex-1 bg-gray-100 py-3 sm:py-4 rounded-2xl font-black text-sm sm:text-base">Cancel</button><button onClick={handleStartClass} className="flex-1 bg-indigo-600 text-white py-3 sm:py-4 rounded-2xl font-black shadow-lg text-sm sm:text-base">Confirm & Start</button></div>
                    </div>
                </div>
            )}

            {/* Modal: Add Room */}
            {showAddRoomModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] w-full max-w-3xl my-auto shadow-2xl animate-in fade-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 p-6 sm:p-8 md:p-10 text-white relative flex-shrink-0">
                            <div className="relative z-10">
                                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight uppercase">Add Classroom</h2>
                                <p className="text-indigo-100 font-bold opacity-80 mt-1 uppercase tracking-widest text-[10px]">New Institutional Space</p>
                            </div>
                            <div className="absolute top-0 right-0 p-8 opacity-10 transform scale-150 rotate-12 hidden sm:block">
                                <svg className="h-24 w-24 md:h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 custom-scrollbar bg-white">
                            <form onSubmit={handleAddRoom} id="addRoomForm" className="p-6 sm:p-8 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 sm:gap-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Room Number</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none transition-all"
                                        value={newRoomData.room_number}
                                        onChange={(e) => setNewRoomData({...newRoomData, room_number: e.target.value})}
                                        required
                                        placeholder="e.g. A-101"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Room Name</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none transition-all"
                                        value={newRoomData.room_name}
                                        onChange={(e) => setNewRoomData({...newRoomData, room_name: e.target.value})}
                                        placeholder="e.g. Computer Lab"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Building</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none transition-all"
                                        value={newRoomData.building}
                                        onChange={(e) => setNewRoomData({...newRoomData, building: e.target.value})}
                                        placeholder="Main Block"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Floor</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none transition-all"
                                        value={newRoomData.floor}
                                        onChange={(e) => setNewRoomData({...newRoomData, floor: e.target.value})}
                                        placeholder="1st Floor"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                                    <select
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none appearance-none"
                                        value={newRoomData.type}
                                        onChange={(e) => setNewRoomData({...newRoomData, type: e.target.value})}
                                        required
                                    >
                                        <option value="Classroom">Classroom</option>
                                        <option value="Lab">Lab</option>
                                        <option value="Seminar Hall">Seminar Hall</option>
                                        <option value="Office">Office</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Capacity</label>
                                    <input
                                        type="number"
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none transition-all"
                                        value={newRoomData.capacity}
                                        onChange={(e) => setNewRoomData({...newRoomData, capacity: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Primary Department</label>
                                    <select
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none appearance-none"
                                        value={newRoomData.department}
                                        onChange={(e) => setNewRoomData({...newRoomData, department: e.target.value})}
                                        required
                                    >
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </form>
                        </div>

                        <div className="p-6 sm:p-8 md:p-10 bg-white border-t border-gray-50 flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowAddRoomModal(false)}
                                className="flex-1 bg-gray-100 text-gray-500 py-3 sm:py-4 md:py-5 rounded-[1.2rem] sm:rounded-[1.5rem] font-black hover:bg-gray-200 transition text-base sm:text-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="addRoomForm"
                                className="flex-1 bg-indigo-600 text-white py-3 sm:py-4 md:py-5 rounded-[1.2rem] sm:rounded-[1.5rem] font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition text-base sm:text-lg"
                            >
                                Create Room
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Room */}
            {showEditRoomModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] w-full max-w-3xl my-auto shadow-2xl animate-in fade-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 p-6 sm:p-8 md:p-10 text-white relative flex-shrink-0">
                            <div className="relative z-10">
                                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight uppercase">Edit Classroom</h2>
                                <p className="text-indigo-100 font-bold opacity-80 mt-1 uppercase tracking-widest text-[10px]">Update Asset Information</p>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 custom-scrollbar bg-white">
                            <form onSubmit={handleUpdateRoom} id="editRoomForm" className="p-6 sm:p-8 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 sm:gap-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Room Number</label>
                                    <input
                                        className="w-full p-3 sm:p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none text-sm"
                                        value={editRoomData.room_number}
                                        onChange={(e) => setEditRoomData({...editRoomData, room_number: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Room Name</label>
                                    <input
                                        className="w-full p-3 sm:p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none text-sm"
                                        value={editRoomData.room_name}
                                        onChange={(e) => setEditRoomData({...editRoomData, room_name: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Building</label>
                                    <input
                                        className="w-full p-3 sm:p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none text-sm"
                                        value={editRoomData.building}
                                        onChange={(e) => setEditRoomData({...editRoomData, building: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Floor</label>
                                    <input
                                        className="w-full p-3 sm:p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none text-sm"
                                        value={editRoomData.floor}
                                        onChange={(e) => setEditRoomData({...editRoomData, floor: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                                    <select
                                        className="w-full p-3 sm:p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none appearance-none text-sm"
                                        value={editRoomData.type}
                                        onChange={(e) => setEditRoomData({...editRoomData, type: e.target.value})}
                                        required
                                    >
                                        <option value="Classroom">Classroom</option>
                                        <option value="Lab">Lab</option>
                                        <option value="Seminar Hall">Seminar Hall</option>
                                        <option value="Office">Office</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Capacity</label>
                                    <input
                                        type="number"
                                        className="w-full p-3 sm:p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none text-sm"
                                        value={editRoomData.capacity}
                                        onChange={(e) => setEditRoomData({...editRoomData, capacity: e.target.value})}
                                        required
                                    />
                                </div>
                            </form>
                        </div>

                        <div className="p-6 sm:p-8 md:p-10 bg-white border-t border-gray-50 flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowEditRoomModal(false)}
                                className="flex-1 bg-gray-100 text-gray-500 py-3 sm:py-4 md:py-5 rounded-[1.2rem] sm:rounded-[1.5rem] font-black hover:bg-gray-200 transition text-base sm:text-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="editRoomForm"
                                className="flex-1 bg-indigo-600 text-white py-3 sm:py-4 md:py-5 rounded-[1.2rem] sm:rounded-[1.5rem] font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition text-base sm:text-lg"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSuccessPopup && (
                <div className="fixed inset-0 flex items-center justify-center z-[100] animate-in fade-in zoom-in duration-300">
                    <div className="bg-white/90 backdrop-blur-xl border border-green-100 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
                        <div className="h-20 w-20 bg-green-500 text-white rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-100">
                            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2">{successMessage.title}</h2>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">{successMessage.sub}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Rooms;
