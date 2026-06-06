import React, { useEffect, useState } from 'react';
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

    useEffect(() => {
        fetchRooms();
        // Continuous real-time updates every 5 seconds
        const interval = setInterval(fetchRooms, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchRooms = async () => {
        try {
            const res = await API.get('/rooms');
            setRooms(res.data || []);

            const sessions = {};
            if (res.data) {
                for (const room of res.data) {
                    if (room.status === 'IN_USE') {
                        try {
                            const sRes = await API.get(`/active-session/${room.id}`);
                            if (sRes.data) {
                                sessions[room.id] = sRes.data;
                            }
                        } catch (e) {
                            console.warn(`Could not fetch session for room ${room.id}`);
                        }
                    }
                }
            }
            setActiveSessions(sessions);
            setLoading(false);
        } catch (err) {
            console.error("Backend unreachable:", err);
            setRooms([]);
            setLoading(false);
        }
    };

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
            alert('Class started successfully!');
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
                alert('Class ended successfully!');
            } else {
                alert('No active session found for this room. Re-syncing status...');
                fetchRooms();
            }
        } catch (err) {
            console.error("End class error:", err);
            const errorMsg = err.response?.data?.detail || 'Failed to end class. Please check if the backend is running.';
            alert(errorMsg);
        }
    };

    const handleAddRoom = async (e) => {
        e.preventDefault();
        try {
            await API.post('/rooms', newRoomData);
            setShowAddRoomModal(false);
            setNewRoomData({
                room_number: '',
                room_name: '',
                floor: '',
                building: '',
                type: 'Classroom',
                capacity: 60,
                department: 'Computer Science'
            });
            fetchRooms();
            alert('Room added successfully!');
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to add room');
        }
    };

    const handleDeleteRoom = async (id, roomNumber, status) => {
        if (status === 'IN_USE') {
            alert('Cannot delete room while a class is in progress.');
            return;
        }

        if (window.confirm(`Are you sure you want to delete Room ${roomNumber}? This action cannot be undone.`)) {
            try {
                await API.delete(`/rooms/${id}`);
                fetchRooms();
                alert('Room deleted successfully.');
            } catch (err) {
                alert(err.response?.data?.detail || 'Failed to delete room');
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

    if (loading) return <div className="p-10 text-center font-bold text-gray-500">Loading Campus Rooms...</div>;

    return (
        <div className="p-10 bg-gray-50 min-h-screen">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Class Room</h1>
                    <p className="text-gray-600 font-medium">Real-time classroom availability.</p>
                </div>
                {role === 'admin' && (
                    <button
                        onClick={() => setShowAddRoomModal(true)}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition"
                    >
                        + Add New Room
                    </button>
                )}
            </header>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {rooms.map((room) => (
                    <div
                        key={room.id}
                        className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between min-h-[160px] relative group"
                    >
                        {role === 'admin' && (
                            <button
                                onClick={() => handleDeleteRoom(room.id, room.room_number, room.status)}
                                className="absolute -top-2 -right-2 bg-red-600 text-white p-2 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 hover:bg-red-700 hover:scale-110"
                                title="Delete Classroom"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        )}
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">{room.room_number}</h3>
                                {room.building && <p className="text-[8px] font-bold text-gray-400 uppercase">{room.building} • Fl {room.floor}</p>}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest border uppercase ${getStatusStyles(room.status)}`}>
                                {room.status === 'IN_USE' ? 'Occupied' : 'Available'}
                            </span>
                        </div>

                        {room.status === 'IN_USE' && activeSessions[room.id] && (
                            <div className="mb-3 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/30 space-y-1.5 animate-in fade-in duration-700">
                                <div className="flex items-center space-x-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                    <p className="text-[10px] font-black text-gray-800 truncate">
                                        {activeSessions[room.id].faculty_name}
                                        <span className="text-indigo-400 text-[8px] font-bold ml-1">({activeSessions[room.id].faculty_id_display})</span>
                                    </p>
                                </div>
                                <div className="pl-3.5 space-y-0.5 border-l border-indigo-100 ml-0.5">
                                    <p className="text-[9px] font-bold text-indigo-600 truncate leading-tight">{activeSessions[room.id].subject}</p>
                                    <div className="flex justify-between items-center pt-0.5">
                                        <span className="text-[8px] text-gray-400 font-black uppercase">Sec {activeSessions[room.id].section}</span>
                                        <span className="text-[8px] text-gray-400 font-bold">{activeSessions[room.id].start_time_display}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {role !== 'student' && (
                            <div className="mt-auto">
                                {room.status === 'AVAILABLE' ? (
                                    <button
                                        onClick={() => { setSelectedRoom(room); setShowStartModal(true); }}
                                        className="w-full bg-green-600 text-white py-2 rounded-xl font-black text-[10px] hover:bg-green-700 transition shadow-sm"
                                    >
                                        Start Class
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleEndClass(room.id)}
                                        className="w-full bg-red-600 text-white py-2 rounded-xl font-black text-[10px] hover:bg-red-700 transition shadow-sm"
                                    >
                                        End Class
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {showStartModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 z-50 overflow-y-auto">
                    {/* ... (existing start modal code remains the same) ... */}
                </div>
            )}

            {showAddRoomModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 z-50 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] w-full max-w-2xl my-auto shadow-2xl animate-in fade-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[95vh]">
                        <div className="bg-indigo-600 p-6 md:p-8 text-white relative flex-shrink-0">
                            <h2 className="text-3xl font-black tracking-tight uppercase">New Classroom</h2>
                            <p className="text-indigo-100 font-bold opacity-80 mt-1 uppercase tracking-widest text-xs">Administrative Access Only</p>
                        </div>

                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            <form onSubmit={handleAddRoom} className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 bg-white">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ROOM NUMBER</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none"
                                        value={newRoomData.room_number}
                                        onChange={(e) => setNewRoomData({...newRoomData, room_number: e.target.value})}
                                        required
                                        placeholder="e.g. A-101"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ROOM NAME</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none"
                                        value={newRoomData.room_name}
                                        onChange={(e) => setNewRoomData({...newRoomData, room_name: e.target.value})}
                                        placeholder="e.g. Smart Lab"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">BUILDING</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none"
                                        value={newRoomData.building}
                                        onChange={(e) => setNewRoomData({...newRoomData, building: e.target.value})}
                                        placeholder="e.g. Science Block"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">FLOOR</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none"
                                        value={newRoomData.floor}
                                        onChange={(e) => setNewRoomData({...newRoomData, floor: e.target.value})}
                                        placeholder="e.g. Ground"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ROOM TYPE</label>
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
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">CAPACITY</label>
                                    <input
                                        type="number"
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none"
                                        value={newRoomData.capacity}
                                        onChange={(e) => setNewRoomData({...newRoomData, capacity: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">DEPARTMENT</label>
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

                        <div className="p-6 md:p-8 bg-white border-t border-gray-50 flex gap-4">
                            <button
                                type="button"
                                onClick={() => setShowAddRoomModal(false)}
                                className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-2xl font-black hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddRoom}
                                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition"
                            >
                                Create Room
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Rooms;
