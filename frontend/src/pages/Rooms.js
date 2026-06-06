import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

const Rooms = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStartModal, setShowStartModal] = useState(false);
    const [showAddRoomModal, setShowAddRoomModal] = useState(false);
    const [showEditRoomModal, setShowEditRoomModal] = useState(false);
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
                fetchRooms();
            }
        } catch (err) {
            alert('Failed to end class');
        }
    };

    const handleAddRoom = async (e) => {
        e.preventDefault();
        try {
            await API.post('/rooms', newRoomData);
            setShowAddRoomModal(false);
            setNewRoomData({
                room_number: '', room_name: '', floor: '', building: '',
                type: 'Classroom', capacity: 60, department: 'Computer Science'
            });
            fetchRooms();
            alert('Room added successfully!');
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to add room. Please login again.');
        }
    };

    const handleUpdateRoom = async (e) => {
        e.preventDefault();
        try {
            await API.put(`/rooms/${selectedRoom.id}`, editRoomData);
            setShowEditRoomModal(false);
            fetchRooms();
            alert('Room updated successfully!');
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to update room');
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

    if (loading) return <div className="p-10 text-center font-bold text-gray-500 tracking-widest uppercase animate-pulse">Loading Campus Classrooms...</div>;

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {rooms.map((room) => (
                    <div
                        key={room.id}
                        className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl transition duration-300 flex flex-col relative group"
                    >
                        {role === 'admin' && (
                            <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button
                                    onClick={() => { setSelectedRoom(room); setEditRoomData(room); setShowEditRoomModal(true); }}
                                    className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg hover:bg-indigo-700 transition"
                                    title="Edit Room"
                                >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-3xl font-black text-gray-900 tracking-tight">{room.room_number}</h3>
                                {room.building && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{room.building} • Floor {room.floor}</p>}
                            </div>
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest border uppercase ${getStatusStyles(room.status)}`}>
                                {room.status === 'IN_USE' ? 'Occupied' : 'Available'}
                            </span>
                        </div>

                        {room.status === 'IN_USE' && activeSessions[room.id] ? (
                            <div className="mb-6 bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] animate-in fade-in duration-500">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Active Session</p>
                                <div className="space-y-3">
                                    <div className="flex items-center">
                                        <div className="h-2 w-2 rounded-full bg-indigo-500 mr-2 animate-pulse"></div>
                                        <p className="text-xs font-bold text-gray-700 truncate">
                                            {activeSessions[room.id].faculty_name}
                                        </p>
                                    </div>
                                    <div className="pl-4 border-l-2 border-indigo-100">
                                        <p className="text-[11px] font-black text-indigo-600 truncate">{activeSessions[room.id].subject}</p>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Sec {activeSessions[room.id].section} • {activeSessions[room.id].start_time_display}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 mb-8">
                                <div className="flex items-center text-gray-500 bg-gray-50 p-4 rounded-2xl border border-gray-100/50">
                                    <svg className="h-6 w-6 mr-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                    </svg>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Department</p>
                                        <p className="text-sm font-bold text-gray-800">{room.department}</p>
                                    </div>
                                </div>
                                <div className="flex items-center text-gray-500 bg-gray-50 p-4 rounded-2xl border border-gray-100/50">
                                    <svg className="h-6 w-6 mr-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857" />
                                    </svg>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tight">Max Capacity</p>
                                        <p className="text-sm font-bold text-gray-800">{room.capacity} Students</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {role !== 'student' && (
                            <div className={`mt-auto flex gap-3`}>
                                {room.status === 'AVAILABLE' ? (
                                    <button
                                        onClick={() => { setSelectedRoom(room); setShowStartModal(true); }}
                                        className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-green-700 transition shadow-lg shadow-green-100"
                                    >
                                        Start Class
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleEndClass(room.id)}
                                        className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-red-700 transition shadow-lg shadow-red-100"
                                    >
                                        End Class
                                    </button>
                                )}
                                {role === 'admin' && (
                                    <button
                                        onClick={() => handleDeleteRoom(room.id, room.room_number, room.status)}
                                        className="bg-gray-100 text-red-600 px-4 rounded-2xl hover:bg-red-50 transition border border-gray-200"
                                        title="Delete Classroom"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal: Start Class */}
            {showStartModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 p-6 text-white"><h2 className="text-2xl font-black uppercase">Start Class • {selectedRoom?.room_number}</h2></div>
                        <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Faculty Name</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-500" value={sessionData.faculty_name} onChange={(e) => setSessionData({...sessionData, faculty_name: e.target.value})} required/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Faculty ID</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none focus:ring-2 ring-indigo-500" value={sessionData.faculty_id_display} onChange={(e) => setSessionData({...sessionData, faculty_id_display: e.target.value})} required/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Department</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={sessionData.department} onChange={(e) => setSessionData({...sessionData, department: e.target.value, subject: ''})} required><option value="">Select Department</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Subject</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={sessionData.subject} onChange={(e) => setSessionData({...sessionData, subject: e.target.value})} required disabled={!sessionData.department}><option value="">Select Subject</option>{sessionData.department && subjectMap[sessionData.department]?.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Section</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={sessionData.section} onChange={(e) => setSessionData({...sessionData, section: e.target.value})} required><option value="">Select Section</option>{['A','B','C','D','E','F'].map(s => <option key={s} value={s}>Section {s}</option>)}</select></div>
                            <div className="flex gap-4"><div className="flex-1"><label className="text-[10px] font-black text-gray-400 uppercase">Date</label><input type="date" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={sessionData.date} readOnly/></div><div className="flex-1"><label className="text-[10px] font-black text-gray-400 uppercase">Time</label><input type="time" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={sessionData.start_time_display} readOnly/></div></div>
                        </div>
                        <div className="p-6 bg-white border-t flex gap-4"><button onClick={() => setShowStartModal(false)} className="flex-1 bg-gray-100 py-4 rounded-2xl font-black">Cancel</button><button onClick={handleStartClass} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">Confirm & Start</button></div>
                    </div>
                </div>
            )}

            {/* Modal: Add Room */}
            {showAddRoomModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-indigo-600 p-6 text-white"><h2 className="text-2xl font-black uppercase">Add New Classroom</h2></div>
                        <div className="p-8 grid grid-cols-2 gap-6">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Room Number</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={newRoomData.room_number} onChange={(e) => setNewRoomData({...newRoomData, room_number: e.target.value})} required/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Room Name</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={newRoomData.room_name} onChange={(e) => setNewRoomData({...newRoomData, room_name: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Building</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={newRoomData.building} onChange={(e) => setNewRoomData({...newRoomData, building: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Floor</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={newRoomData.floor} onChange={(e) => setNewRoomData({...newRoomData, floor: e.target.value})}/></div>
                        </div>
                        <div className="p-6 border-t flex gap-4"><button onClick={() => setShowAddRoomModal(false)} className="flex-1 bg-gray-100 py-4 rounded-2xl font-black">Cancel</button><button onClick={handleAddRoom} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">Create Room</button></div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Room */}
            {showEditRoomModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-indigo-600 p-6 text-white"><h2 className="text-2xl font-black uppercase">Edit Classroom</h2></div>
                        <div className="p-8 grid grid-cols-2 gap-6">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Room Number</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={editRoomData.room_number} onChange={(e) => setEditRoomData({...editRoomData, room_number: e.target.value})} required/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Room Name</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={editRoomData.room_name} onChange={(e) => setEditRoomData({...editRoomData, room_name: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Building</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={editRoomData.building} onChange={(e) => setEditRoomData({...editRoomData, building: e.target.value})}/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Floor</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={editRoomData.floor} onChange={(e) => setEditRoomData({...editRoomData, floor: e.target.value})}/></div>
                        </div>
                        <div className="p-6 border-t flex gap-4"><button onClick={() => setShowEditRoomModal(false)} className="flex-1 bg-gray-100 py-4 rounded-2xl font-black">Cancel</button><button onClick={handleUpdateRoom} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">Save Changes</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Rooms;
