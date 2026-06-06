import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api';

const RoomDetails = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const role = localStorage.getItem('role');
    const [room, setRoom] = useState(null);
    const [detail, setDetail] = useState({
        faculty_name: '',
        department: 'Computer Science',
        subject_name: 'Python Programming',
        class_section: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        remarks: ''
    });
    const [detailId, setDetailId] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);

    const departments = ['Computer Science', 'Physics', 'Mathematics', 'Chemistry', 'Mechanical Engineering', 'Civil Engineering'];
    const subjects = ['Python Programming', 'Physics Lab', 'Data Structures', 'Database Systems', 'Calculus', 'Thermodynamics'];

    useEffect(() => {
        fetchRoomAndDetails();
    }, [roomId]);

    const fetchRoomAndDetails = async () => {
        try {
            const roomsRes = await API.get('/rooms');
            const currentRoom = roomsRes.data.find(r => r.id === parseInt(roomId));
            setRoom(currentRoom);

            const detailRes = await API.get(`/room-details/${roomId}`);
            if (detailRes.data) {
                setDetail(detailRes.data);
                setDetailId(detailRes.data.id);
                setIsEditing(false);
            } else {
                setIsEditing(true);
            }
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const data = { ...detail, room_id: parseInt(roomId) };
            if (detailId) {
                await API.put(`/room-details/${detailId}`, data);
            } else {
                const res = await API.post('/room-details', data);
                setDetailId(res.data.id);
            }
            setIsEditing(false);
            alert('Details saved successfully!');
        } catch (err) {
            alert('Failed to save details');
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete these details?')) {
            try {
                await API.delete(`/room-details/${detailId}`);
                setDetail({
                    faculty_name: '',
                    department: 'Computer Science',
                    subject_name: 'Python Programming',
                    class_section: '',
                    date: new Date().toISOString().split('T')[0],
                    time: '',
                    remarks: ''
                });
                setDetailId(null);
                setIsEditing(true);
                alert('Details deleted');
            } catch (err) {
                alert('Failed to delete');
            }
        }
    };

    if (loading) return <div className="p-10 text-center">Loading...</div>;
    if (!room) return <div className="p-10 text-center text-red-500 font-bold">Room not found</div>;

    return (
        <div className="p-10 bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => navigate('/rooms')}
                    className="mb-6 flex items-center text-indigo-600 font-bold hover:underline"
                >
                    <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Class Room
                </button>

                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="bg-indigo-600 p-8 text-white">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-3xl font-black tracking-tight">Class Room {room.room_number}</h1>
                                <p className="text-indigo-100 font-medium">{room.type} • {room.department}</p>
                            </div>
                            <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
                                room.status === 'AVAILABLE' ? 'bg-green-400' : 'bg-red-400'
                            }`}>
                                {room.status}
                            </span>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                            <h2 className="text-xl font-bold text-gray-800">Class Session Details</h2>
                            {role !== 'student' && !isEditing && (
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-100 transition"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition"
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-600 ml-1">Faculty Name</label>
                                <input
                                    className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition ${!isEditing ? 'bg-gray-50 border-transparent cursor-default' : 'bg-white border-gray-200'}`}
                                    value={detail.faculty_name}
                                    onChange={(e) => setDetail({...detail, faculty_name: e.target.value})}
                                    readOnly={!isEditing}
                                    required
                                    placeholder="Enter faculty name"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-600 ml-1">Department</label>
                                <select
                                    className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition ${!isEditing ? 'bg-gray-50 border-transparent cursor-default pointer-events-none' : 'bg-white border-gray-200'}`}
                                    value={detail.department}
                                    onChange={(e) => setDetail({...detail, department: e.target.value})}
                                    disabled={!isEditing}
                                >
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-600 ml-1">Subject Name</label>
                                <select
                                    className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition ${!isEditing ? 'bg-gray-50 border-transparent cursor-default pointer-events-none' : 'bg-white border-gray-200'}`}
                                    value={detail.subject_name}
                                    onChange={(e) => setDetail({...detail, subject_name: e.target.value})}
                                    disabled={!isEditing}
                                >
                                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-600 ml-1">Class Section</label>
                                <input
                                    className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition ${!isEditing ? 'bg-gray-50 border-transparent cursor-default' : 'bg-white border-gray-200'}`}
                                    value={detail.class_section}
                                    onChange={(e) => setDetail({...detail, class_section: e.target.value})}
                                    readOnly={!isEditing}
                                    required
                                    placeholder="e.g. CSE-A"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-600 ml-1">Date</label>
                                <input
                                    type="date"
                                    className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition ${!isEditing ? 'bg-gray-50 border-transparent cursor-default' : 'bg-white border-gray-200'}`}
                                    value={detail.date}
                                    onChange={(e) => setDetail({...detail, date: e.target.value})}
                                    readOnly={!isEditing}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-600 ml-1">Time</label>
                                <input
                                    type="time"
                                    className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition ${!isEditing ? 'bg-gray-50 border-transparent cursor-default' : 'bg-white border-gray-200'}`}
                                    value={detail.time}
                                    onChange={(e) => setDetail({...detail, time: e.target.value})}
                                    readOnly={!isEditing}
                                    required
                                />
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm font-bold text-gray-600 ml-1">Remarks</label>
                                <textarea
                                    className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition h-24 resize-none ${!isEditing ? 'bg-gray-50 border-transparent cursor-default' : 'bg-white border-gray-200'}`}
                                    value={detail.remarks}
                                    onChange={(e) => setDetail({...detail, remarks: e.target.value})}
                                    readOnly={!isEditing}
                                    placeholder="Any additional notes..."
                                />
                            </div>

                            {isEditing && (
                                <div className="md:col-span-2 pt-4 flex space-x-3">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-indigo-600 text-white p-4 rounded-xl font-black shadow-lg hover:bg-indigo-700 transition"
                                    >
                                        Save Details
                                    </button>
                                    {detailId && (
                                        <button
                                            type="button"
                                            onClick={() => setIsEditing(false)}
                                            className="px-6 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoomDetails;
