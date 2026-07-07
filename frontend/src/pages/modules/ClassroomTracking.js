import React, { useEffect, useState, useCallback } from 'react';
import API from '../../api';
import { useRegistry } from '../../context/RegistryContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle,
    Search,
    RefreshCw,
    Trash2,
    Plus
} from 'lucide-react';

const ClassroomTracking = () => {
    const { datasets } = useRegistry();
    const role = localStorage.getItem('role')?.toLowerCase();
    const canManageSessions = role !== 'student';
    const canManageRooms = ['admin', 'super_admin'].includes(role);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showStartModal, setShowModal] = useState(false);
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);

    const [formData, setFormData] = useState({
        faculty_name: '',
        dept_id: '',
        subject_name: ''
    });
    const [roomForm, setRoomForm] = useState({
        room_number: '',
        building: '',
        capacity: 60,
        type: 'Classroom',
        status: 'Available'
    });

    const [message, setMessage] = useState({ text: '', type: '' });

    const getApiError = (err, fallback) => {
        const data = err.response?.data;
        if (!data) return fallback;
        if (typeof data === 'string') return data;
        if (data.detail) return data.detail;
        const firstError = Object.entries(data)[0];
        if (!firstError) return fallback;
        const [field, value] = firstError;
        const text = Array.isArray(value) ? value.join(', ') : String(value);
        return `${field}: ${text}`;
    };

    const fetchLiveRooms = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await API.get('/live-rooms/');
            setRooms(res.data);
        } catch (err) {
            console.error("Failed to sync classroom telemetry.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLiveRooms();
        const timer = setInterval(() => fetchLiveRooms(true), 15000);
        return () => clearInterval(timer);
    }, [fetchLiveRooms]);

    const calculateDuration = (startTime) => {
        const start = new Date(startTime);
        const now = new Date();
        const diff = Math.floor((now - start) / 1000 / 60);
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        return `${hours}H ${mins}M`;
    };

    const handleStartClass = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });
        try {
            await API.post('/start-session/', {
                room_id: selectedRoom.id,
                faculty_name: formData.faculty_name,
                department_id: Number(formData.dept_id),
                subject_name: formData.subject_name
            });
            setMessage({ text: 'CLASS STARTED SUCCESSFULLY', type: 'success' });
            setTimeout(() => {
                setShowModal(false);
                fetchLiveRooms(true);
            }, 1500);
        } catch (err) {
            setMessage({ text: getApiError(err, 'SESSION INITIATION FAILED'), type: 'error' });
        }
    };

    const handleEndClass = async (room) => {
        if (!window.confirm(`Are you sure you want to end session in ${room.room_number}?`)) return;
        try {
            await API.post('/end-session/', {
                session_id: room.session.id,
                user_id: localStorage.getItem('user_id')
            });
            fetchLiveRooms(true);
        } catch (err) {
            alert(err.response?.data?.detail || "END SESSION REJECTED");
        }
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });
        const block = (roomForm.building || 'Main Block').trim();
        const roomNumber = String(roomForm.room_number || '').trim();
        const duplicate = rooms.some(room =>
            String(room.building || 'Main Block').trim().toLowerCase() === block.trim().toLowerCase() &&
            String(room.room_number).trim().toLowerCase() === roomNumber.toLowerCase()
        );

        if (duplicate) {
            setMessage({ text: `Classroom ${roomNumber} already exists in ${block}.`, type: 'error' });
            return;
        }

        try {
            const res = await API.post('/rooms/', {
                ...roomForm,
                room_number: roomNumber,
                capacity: Number(roomForm.capacity),
                building: block
            });
            setRooms(prev => [...prev, res.data].sort((a, b) => {
                const blockCompare = String(a.building || '').localeCompare(String(b.building || ''));
                if (blockCompare !== 0) return blockCompare;
                return String(a.room_number || '').localeCompare(String(b.room_number || ''), undefined, { numeric: true });
            }));
            setSearchTerm('');
            setRoomForm({ room_number: '', building: '', capacity: 60, type: 'Classroom', status: 'Available' });
            setShowRoomModal(false);
            await fetchLiveRooms(true);
        } catch (err) {
            setMessage({ text: getApiError(err, 'ROOM CREATION FAILED'), type: 'error' });
        }
    };

    const handleDeleteRoom = async (room) => {
        if (!window.confirm(`Delete classroom ${room.room_number}?`)) return;
        try {
            await API.delete(`/rooms/${room.id}/`);
            fetchLiveRooms(true);
        } catch (err) {
            alert(err.response?.data?.detail || "DELETE REJECTED");
        }
    };

    const filteredRooms = rooms.filter(r => {
        const matchesSearch = r.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.building || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.session?.faculty_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.session?.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });
    const groupedRooms = filteredRooms.reduce((groups, room) => {
        const block = room.building || 'Main Block';
        if (!groups[block]) groups[block] = [];
        groups[block].push(room);
        return groups;
    }, {});

    if (loading && rooms.length === 0) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <RefreshCw className="animate-spin text-indigo-600" size={32} />
        </div>
    );

    return (
        <div className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 space-y-10 bg-slate-50">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tightest uppercase italic">
                        Classroom <span className="text-indigo-600">Module</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Live Facility Intelligence</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                        <input
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500 shadow-sm transition-all"
                            placeholder="Search Classroom / Faculty..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {canManageRooms && <button onClick={() => { setMessage({ text: '', type: '' }); setShowRoomModal(true); }} className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-700 hover:text-indigo-600 transition-all shadow-sm font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <Plus size={16} />
                        Create Classroom
                    </button>}
                </div>
            </header>

            {/* ROOM GRID */}
            {Object.entries(groupedRooms).map(([block, blockRooms]) => (
                <section key={block} className="space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{block}</h2>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{blockRooms.length} Classrooms</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {blockRooms.map(room => (
                    <motion.div
                        layout
                        key={room.id}
                        className="bg-[#1e1e1e] rounded-md shadow-lg overflow-hidden min-h-[285px] flex flex-col group border border-white/5"
                    >
                        <div className="h-24 relative overflow-hidden">
                            <img
                                src="/classroom-card-bg.png"
                                alt="Classroom"
                                className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] via-[#1e1e1e]/25 to-white/10"></div>
                            <span className={`absolute top-3 right-3 shrink-0 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest backdrop-blur-sm ${room.status === 'Available' ? 'bg-emerald-500/20 text-emerald-100' : 'bg-rose-500/20 text-rose-100'}`}>
                                {room.status}
                            </span>
                        </div>

                        <div className="p-5 flex-1 flex flex-col">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-300 truncate">{room.building || 'Main Block'}</p>
                                    <h3 className="text-3xl font-black text-white tracking-tight mt-2 uppercase truncate">{room.room_number}</h3>
                                    <p className="text-sm font-bold text-slate-400 mt-2">{room.type}</p>
                                </div>
                            </div>

                            <div className="mt-5 min-w-0">
                                {room.status === 'Occupied' ? (
                                    <div className="space-y-1.5">
                                        <p className="text-sm font-black text-white truncate">{room.session?.faculty_name || 'Faculty'}</p>
                                        <p className="text-sm font-bold text-slate-300 truncate">{room.session?.subject_name || 'Subject'}</p>
                                        <p className="text-xs font-bold text-slate-500 uppercase truncate">{room.session?.department_name || 'Department'}</p>
                                        <p className="text-[10px] font-black text-rose-300 uppercase tracking-widest pt-1">{calculateDuration(room.session?.start_time)}</p>
                                    </div>
                                ) : (
                                    <p className="text-sm font-bold text-slate-300 leading-relaxed">
                                        Available for {room.capacity} students.
                                    </p>
                                )}
                            </div>

                            <div className="mt-auto flex items-center gap-3 pt-6">
                                {canManageSessions ? (
                                    room.status === 'Available' ? (
                                        <button
                                            onClick={() => { setSelectedRoom(room); setShowModal(true); }}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-black uppercase text-xs tracking-wide shadow-lg shadow-emerald-950/20 transition-all"
                                        >
                                            Start Class
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleEndClass(room)}
                                            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-md font-black uppercase text-xs tracking-wide shadow-lg shadow-rose-950/20 transition-all"
                                        >
                                            End Class
                                        </button>
                                    )
                                ) : (
                                    <span className="text-slate-400 font-black uppercase text-xs tracking-wide">View Only</span>
                                )}
                                {canManageRooms && (
                                    <button onClick={() => handleDeleteRoom(room)} className="ml-auto text-rose-400 hover:text-rose-300 transition-all">
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
                    </div>
                </section>
            ))}

            {filteredRooms.length === 0 && (
                <div className="py-16 text-center bg-white rounded-3xl border border-slate-100">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">No classrooms found</p>
                </div>
            )}

            <AnimatePresence>
                {showRoomModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl"
                        >
                            <div className="bg-slate-900 p-8 text-white">
                                <h3 className="text-2xl font-black uppercase tracking-tight">Create Classroom</h3>
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] mt-2 text-slate-400">Organize by block</p>
                            </div>
                            <form onSubmit={handleCreateRoom} className="p-8 space-y-5">
                                {message.text && <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-[10px] font-black uppercase">{message.text}</div>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <input className="p-4 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Block Name" value={roomForm.building} onChange={e => setRoomForm({ ...roomForm, building: e.target.value })} required />
                                    <input className="p-4 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Classroom Number" value={roomForm.room_number} onChange={e => setRoomForm({ ...roomForm, room_number: e.target.value })} required />
                                    <input type="number" className="p-4 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Capacity" value={roomForm.capacity} onChange={e => setRoomForm({ ...roomForm, capacity: e.target.value })} required />
                                    <select className="p-4 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={roomForm.type} onChange={e => setRoomForm({ ...roomForm, type: e.target.value })}>
                                        <option value="Classroom">Classroom</option>
                                        <option value="Lab">Lab</option>
                                        <option value="Seminar Hall">Seminar Hall</option>
                                    </select>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setShowRoomModal(false)} className="flex-1 py-4 border-2 border-slate-100 text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
                                    <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">Create</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showStartModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-[#1e1e1e] w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl border border-white/10"
                        >
                            <div className="bg-indigo-600 p-10 text-white">
                                <h3 className="text-3xl font-black uppercase tracking-tighter italic">Start Session</h3>
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] mt-2 text-indigo-200">Activating {selectedRoom?.room_number}</p>
                            </div>

                            <form onSubmit={handleStartClass} className="p-10 space-y-6">
                                {message.text && (
                                    <div className={`p-5 rounded-2xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
                                        <CheckCircle size={18}/>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{message.text}</span>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Faculty Name</label>
                                        <input className="w-full p-4 bg-[#2a2a2a] border-none rounded-2xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter faculty name" value={formData.faculty_name} onChange={e => setFormData({ ...formData, faculty_name: e.target.value })} required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Department</label>
                                        <select className="w-full p-4 bg-[#2a2a2a] border-none rounded-2xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.dept_id} onChange={e => setFormData({ ...formData, dept_id: e.target.value })} required>
                                            <option value="">Select Dept</option>
                                            {(datasets.departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Subject</label>
                                        <input className="w-full p-4 bg-[#2a2a2a] border-none rounded-2xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter subject" value={formData.subject_name} onChange={e => setFormData({ ...formData, subject_name: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-8">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 border-2 border-white/5 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all">Cancel</button>
                                    <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all">Confirm</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ClassroomTracking;
