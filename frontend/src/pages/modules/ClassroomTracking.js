import React, { useEffect, useState, useCallback, useDeferredValue, useMemo } from 'react';
import API from '../../api';
import { authGet } from '../../authSession';
import { useRegistry } from '../../context/RegistryContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle,
    Search,
    RefreshCw,
    Trash2,
    Plus
} from 'lucide-react';

const toDateTimeLocal = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultClassTimes = () => {
    const start = new Date();
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
        class_start_time: toDateTimeLocal(start),
        class_end_time: toDateTimeLocal(end)
    };
};

const formatDateTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const BLOCK_OPTIONS = ['S-Block', 'P-Block', 'N-Block', 'E-Block'];

const ClassroomTracking = () => {
    const { datasets } = useRegistry();
    const role = authGet('role')?.toLowerCase();
    const userName = authGet('name') || '';
    const storedDepartmentId = authGet('department_id') || '';
    const storedDepartmentName = authGet('department_name') || '';
    const classroomPermission = authGet('classroom_permission') || (['admin', 'super_admin'].includes(role) ? 'manage_classrooms' : role === 'faculty' ? 'class_session' : 'view_only');
    const canManageSessions = ['class_session', 'manage_classrooms'].includes(classroomPermission);
    const canManageRooms = classroomPermission === 'manage_classrooms';
    const isFaculty = role === 'faculty';
    const [activeBlock, setActiveBlock] = useState('S-Block');
    const [roomsByBlock, setRoomsByBlock] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const deferredSearchTerm = useDeferredValue(searchTerm);
    const [availabilityFilter, setAvailabilityFilter] = useState('all');
    const [showStartModal, setShowModal] = useState(false);
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);

    const [formData, setFormData] = useState({
        faculty_name: isFaculty ? userName : '',
        dept_id: storedDepartmentId,
        subject_name: '',
        ...defaultClassTimes()
    });
    const [roomForm, setRoomForm] = useState({
        room_number: '',
        building: 'S-Block',
        capacity: 60,
        type: 'Classroom',
        status: 'Available'
    });

    const [message, setMessage] = useState({ text: '', type: '' });

    const rooms = useMemo(() => roomsByBlock[activeBlock] || [], [roomsByBlock, activeBlock]);

    const getApiError = (err, fallback) => {
        const data = err.response?.data;
        if (!data) return fallback;
        if (typeof data === 'string') {
            if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) return fallback;
            return data;
        }
        if (data.detail) return data.detail;
        const firstError = Object.entries(data)[0];
        if (!firstError) return fallback;
        const [field, value] = firstError;
        const text = Array.isArray(value) ? value.join(', ') : String(value);
        return `${field}: ${text}`;
    };

    const roomBlockName = (room) => room.block_name || room.block_code || room.building || activeBlock;

    const sortRooms = (items) => [...items].sort((a, b) =>
        String(a.room_number || '').localeCompare(String(b.room_number || ''), undefined, { numeric: true })
    );

    const roomStatus = (room) => String(room.status || 'Available').toLowerCase();

    const fetchLiveRooms = useCallback(async (block = activeBlock, silent = false, force = false) => {
        const hasCachedRooms = Array.isArray(roomsByBlock[block]);
        if (hasCachedRooms && !force) return;
        if (!silent && !hasCachedRooms) setLoading(true);
        try {
            let res;
            try {
                res = await API.get(`/live-rooms/?block=${encodeURIComponent(block)}`);
            } catch (err) {
                if (err.response?.status !== 404) throw err;
                res = await API.get(`/rooms/?block=${encodeURIComponent(block)}`);
            }
            const sortedRooms = sortRooms(Array.isArray(res.data) ? res.data : []);
            setRoomsByBlock(prev => ({ ...prev, [block]: sortedRooms }));
        } catch (err) {
            console.error("Failed to sync classroom telemetry.");
            if (err.response?.status === 401) {
                setMessage({ text: 'LOGIN SESSION EXPIRED. PLEASE SIGN IN AGAIN.', type: 'error' });
            } else {
                setMessage({ text: getApiError(err, 'CLASSROOM LIST SYNC FAILED'), type: 'error' });
            }
        } finally {
            if (block === activeBlock) setLoading(false);
        }
    }, [activeBlock, roomsByBlock]);

    useEffect(() => {
        fetchLiveRooms(activeBlock, Boolean(roomsByBlock[activeBlock]));
        const refreshIfVisible = () => {
            if (!document.hidden) fetchLiveRooms(activeBlock, true, true);
        };
        const timer = setInterval(refreshIfVisible, 30000);
        document.addEventListener('visibilitychange', refreshIfVisible);
        window.addEventListener('focus', refreshIfVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', refreshIfVisible);
            window.removeEventListener('focus', refreshIfVisible);
        };
    }, [activeBlock, fetchLiveRooms, roomsByBlock]);

    useEffect(() => {
        BLOCK_OPTIONS
            .filter(block => block !== activeBlock)
            .forEach(block => fetchLiveRooms(block, true));
    }, [activeBlock, fetchLiveRooms]);

    useEffect(() => {
        if (!isFaculty) return;
        const fallbackDepartment = (datasets.departments || []).find(d => String(d.id) === String(storedDepartmentId)) || (datasets.departments || [])[0];
        setFormData(prev => ({
            ...prev,
            faculty_name: prev.faculty_name || userName,
            dept_id: storedDepartmentId || (fallbackDepartment?.id ? String(fallbackDepartment.id) : '')
        }));
    }, [datasets.departments, isFaculty, storedDepartmentId, userName]);

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
                subject_name: formData.subject_name,
                class_start_time: formData.class_start_time,
                class_end_time: formData.class_end_time
            });
            setMessage({ text: 'CLASS STARTED SUCCESSFULLY', type: 'success' });
            setTimeout(() => {
                setShowModal(false);
                fetchLiveRooms(activeBlock, true, true);
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
                user_id: authGet('user_id')
            });
            fetchLiveRooms(activeBlock, true, true);
        } catch (err) {
            alert(err.response?.data?.detail || "END SESSION REJECTED");
        }
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });
        const block = (roomForm.building || activeBlock).trim();
        const roomNumber = String(roomForm.room_number || '').trim();
        const duplicate = rooms.some(room =>
            String(roomBlockName(room)).trim().toLowerCase() === block.trim().toLowerCase() &&
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
            setRoomsByBlock(prev => ({
                ...prev,
                [block]: sortRooms([...(prev[block] || []), res.data])
            }));
            setSearchTerm('');
            setRoomForm({ room_number: '', building: block, capacity: 60, type: 'Classroom', status: 'Available' });
            setShowRoomModal(false);
            setActiveBlock(block);
            fetchLiveRooms(block, true, true);
        } catch (err) {
            setMessage({ text: getApiError(err, 'ROOM CREATION FAILED'), type: 'error' });
        }
    };

    const handleDeleteRoom = async (room) => {
        if (!window.confirm(`Delete classroom ${room.room_number}?`)) return;
        try {
            await API.delete(`/rooms/${room.id}/`);
            setRoomsByBlock(prev => ({
                ...prev,
                [activeBlock]: (prev[activeBlock] || []).filter(item => item.id !== room.id)
            }));
            fetchLiveRooms(activeBlock, true, true);
        } catch (err) {
            alert(err.response?.data?.detail || "DELETE REJECTED");
        }
    };

    const filteredRooms = useMemo(() => {
        const normalizedSearch = deferredSearchTerm.trim().toLowerCase();
        return rooms.filter(r => {
            const status = roomStatus(r);
            const roomNumber = String(r.room_number || '');
            const blockName = r.block_name || r.block_code || r.building || activeBlock;
            const matchesSearch = !normalizedSearch ||
                roomNumber.toLowerCase().includes(normalizedSearch) ||
                blockName.toLowerCase().includes(normalizedSearch) ||
                (r.session?.faculty_name || '').toLowerCase().includes(normalizedSearch) ||
                (r.session?.subject_name || '').toLowerCase().includes(normalizedSearch) ||
                (r.booking?.user_name || '').toLowerCase().includes(normalizedSearch);
            const matchesAvailability =
                availabilityFilter === 'available' ? status === 'available' :
                availabilityFilter === 'booked' ? status === 'booked' :
                availabilityFilter === 'non_available' ? status !== 'available' && status !== 'booked' :
                true;
            return matchesSearch && matchesAvailability;
        });
    }, [rooms, activeBlock, deferredSearchTerm, availabilityFilter]);

    const availabilityFilters = [
        { key: 'available', label: 'Available', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-100', idleClass: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
        { key: 'non_available', label: 'Non-Available', activeClass: 'bg-rose-600 text-white border-rose-600 shadow-rose-100', idleClass: 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50' },
        { key: 'booked', label: 'Booked', activeClass: 'bg-amber-600 text-white border-amber-600 shadow-amber-100', idleClass: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50' }
    ];

    if (loading && rooms.length === 0) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <RefreshCw className="animate-spin text-indigo-600" size={32} />
        </div>
    );

    return (
        <div className="min-h-screen -m-4 md:-m-8 p-2 md:p-8 space-y-6 md:space-y-10 bg-slate-50">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tightest uppercase italic">
                        Class <span className="text-indigo-600">Rooms</span>
                    </h1>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    {canManageRooms && <button onClick={() => { setMessage({ text: '', type: '' }); setRoomForm(prev => ({ ...prev, building: activeBlock })); setShowRoomModal(true); }} className="px-6 py-3.5 bg-white border border-slate-300 rounded-2xl text-slate-800 hover:text-indigo-700 transition-all shadow-md font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <Plus size={16} />
                        Create Classroom
                    </button>}
                </div>
            </header>

            <div className="flex flex-wrap gap-3">
                {BLOCK_OPTIONS.map(block => (
                    <button
                        key={block}
                        onClick={() => {
                            setActiveBlock(block);
                            setSearchTerm('');
                            setLoading(!roomsByBlock[block]);
                        }}
                        className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${activeBlock === block ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-700 border-slate-300 hover:text-indigo-700 hover:border-indigo-300'}`}
                    >
                        {block}
                    </button>
                ))}
            </div>

            {message.text && !showRoomModal && !showStartModal && (
                <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                    {message.text}
                </div>
            )}

            {/* ROOM GRID */}
            <section className="space-y-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-3">
                        <div className="flex flex-wrap items-center gap-4">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{activeBlock}</h2>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{filteredRooms.length} Classrooms</span>
                        </div>
                        <div className="w-full lg:w-[30rem] space-y-3">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                <input
                                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-300 rounded-2xl text-xs font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-indigo-500 shadow-sm transition-all"
                                    placeholder="Search classrooms or faculty"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {availabilityFilters.map(filter => {
                                    const isActive = availabilityFilter === filter.key;
                                    return (
                                        <button
                                            key={filter.key}
                                            type="button"
                                            onClick={() => setAvailabilityFilter(isActive ? 'all' : filter.key)}
                                            className={`px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${isActive ? filter.activeClass : filter.idleClass}`}
                                        >
                                            {filter.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 xl:gap-5">
                {filteredRooms.map(room => {
                    const isOccupied = room.status === 'Occupied';
                    const isBooked = room.status === 'Booked';
                    const isOwnBooking = isBooked && String(room.booking?.user) === String(authGet('user_id'));
                    return (
                    <div
                        key={room.id}
                        className="bg-[#1e1e1e] rounded-md shadow-lg overflow-hidden min-h-[158px] sm:min-h-[235px] lg:min-h-[285px] flex flex-col group border border-white/5"
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '285px' }}
                    >
                        <div className="h-12 sm:h-20 lg:h-24 relative overflow-hidden">
                            <img
                                src="/classroom-card-bg.png"
                                alt="Classroom"
                                className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] via-[#1e1e1e]/25 to-white/10"></div>
                        </div>

                        <div className="p-2 sm:p-4 lg:p-5 flex-1 flex flex-col">
                            <div className="flex items-start justify-between gap-2 sm:gap-3">
                                <div className="min-w-0">
                                    <p className="text-[9px] sm:text-sm font-bold text-slate-300 truncate">{room.block_name || room.building || 'S-Block'}</p>
                                    <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-white tracking-tight mt-1 sm:mt-2 uppercase truncate">{room.room_number}</h3>
                                    <p className="text-[9px] sm:text-sm font-bold text-slate-400 mt-1 sm:mt-2 truncate">{room.type}</p>
                                </div>
                            </div>

                            <div className="mt-2 sm:mt-4 lg:mt-5 min-w-0">
                                {isOccupied ? (
                                    <div className="space-y-1 sm:space-y-1.5">
                                        <p className="text-[9px] sm:text-sm font-black text-white truncate">{room.session?.faculty_name || 'Faculty'}</p>
                                        <p className="hidden sm:block text-sm font-bold text-slate-300 truncate">{room.session?.subject_name || 'Subject'}</p>
                                        <p className="hidden sm:block text-xs font-bold text-slate-500 uppercase truncate">{room.session?.department_name || 'Department'}</p>
                                        <p className="hidden sm:block text-[10px] font-black text-rose-300 uppercase tracking-widest pt-1">
                                            {formatDateTime(room.session?.start_time)} - {formatDateTime(room.session?.end_time)}
                                        </p>
                                        <p className="text-[8px] sm:text-[10px] font-black text-rose-200 uppercase tracking-widest">{calculateDuration(room.session?.start_time)} elapsed</p>
                                    </div>
                                ) : isBooked ? (
                                    <div className="space-y-1 sm:space-y-1.5">
                                        <p className="text-[9px] sm:text-sm font-black text-amber-200 truncate">Booked</p>
                                        <p className="text-[9px] sm:text-sm font-bold text-slate-300 truncate">By {room.booking?.user_name || 'Faculty'}</p>
                                        <p className="hidden sm:block text-[10px] font-black text-amber-300 uppercase tracking-widest pt-1">
                                            {formatDateTime(room.booking?.start_time)} - {formatDateTime(room.booking?.end_time)}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[9px] sm:text-sm font-bold text-slate-300 leading-snug sm:leading-relaxed">
                                        <span className="sm:hidden">{room.capacity} Seats</span>
                                        <span className="hidden sm:inline">Available for {room.capacity} students.</span>
                                    </p>
                                )}
                            </div>

                            <div className="mt-auto flex items-center gap-1.5 sm:gap-3 pt-2 sm:pt-5 lg:pt-6">
                                {canManageSessions ? (
                                    !isOccupied && (!isBooked || isOwnBooking || canManageRooms) ? (
                                        <button
                                            onClick={() => {
                                                const nextTimes = defaultClassTimes();
                                                setSelectedRoom(room);
                                                setFormData(prev => ({
                                                    ...prev,
                                                    faculty_name: isFaculty ? userName : prev.faculty_name,
                                                    dept_id: isFaculty ? (storedDepartmentId || prev.dept_id) : prev.dept_id,
                                                    class_start_time: room.booking?.start_time ? toDateTimeLocal(new Date(room.booking.start_time)) : nextTimes.class_start_time,
                                                    class_end_time: room.booking?.end_time ? toDateTimeLocal(new Date(room.booking.end_time)) : nextTimes.class_end_time
                                                }));
                                                setShowModal(true);
                                            }}
                                            className="px-2 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-black uppercase text-[8px] sm:text-xs tracking-wide shadow-lg shadow-emerald-950/20 transition-all"
                                        >
                                            <span className="sm:hidden">Start</span>
                                            <span className="hidden sm:inline">Start Class</span>
                                        </button>
                                    ) : isOccupied ? (
                                        <button
                                            onClick={() => handleEndClass(room)}
                                            className="px-2 sm:px-4 py-1.5 sm:py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-md font-black uppercase text-[8px] sm:text-xs tracking-wide shadow-lg shadow-rose-950/20 transition-all"
                                        >
                                            <span className="sm:hidden">End</span>
                                            <span className="hidden sm:inline">End Class</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="px-2 sm:px-4 py-1.5 sm:py-2 bg-amber-600 text-white rounded-md font-black uppercase text-[8px] sm:text-xs tracking-wide cursor-default shadow-lg shadow-amber-950/20"
                                        >
                                            Booked
                                        </button>
                                    )
                                ) : (
                                    <button
                                        type="button"
                                        className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md font-black uppercase text-[8px] sm:text-xs tracking-wide cursor-default shadow-lg ${room.status === 'Available' ? 'bg-emerald-600 text-white shadow-emerald-950/20' : room.status === 'Booked' ? 'bg-amber-600 text-white shadow-amber-950/20' : 'bg-rose-600 text-white shadow-rose-950/20'}`}
                                    >
                                        {room.status}
                                    </button>
                                )}
                                {canManageRooms && (
                                    <button onClick={() => handleDeleteRoom(room)} className="ml-auto text-rose-400 hover:text-rose-300 transition-all">
                                        <Trash2 className="w-3.5 h-3.5 sm:w-[15px] sm:h-[15px]" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );})}
                    </div>
                </section>

            {filteredRooms.length === 0 && (
                <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-600">No classrooms found</p>
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
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] mt-2 text-slate-300">Organize by block</p>
                            </div>
                            <form onSubmit={handleCreateRoom} className="p-8 space-y-5">
                                {message.text && <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-[10px] font-black uppercase">{message.text}</div>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <select className="p-4 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" value={roomForm.building} onChange={e => setRoomForm({ ...roomForm, building: e.target.value })} required>
                                        {BLOCK_OPTIONS.map(block => <option key={block} value={block}>{block}</option>)}
                                    </select>
                                    <input className="p-4 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Classroom Number" value={roomForm.room_number} onChange={e => setRoomForm({ ...roomForm, room_number: e.target.value })} required />
                                    <input type="number" className="p-4 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Capacity" value={roomForm.capacity} onChange={e => setRoomForm({ ...roomForm, capacity: e.target.value })} required />
                                    <select className="p-4 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" value={roomForm.type} onChange={e => setRoomForm({ ...roomForm, type: e.target.value })}>
                                        <option value="Classroom">Classroom</option>
                                        <option value="Lab">Lab</option>
                                        <option value="Seminar Hall">Seminar Hall</option>
                                    </select>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setShowRoomModal(false)} className="flex-1 py-4 border-2 border-slate-300 text-slate-700 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50">Cancel</button>
                                    <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">Create</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showStartModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-[#1e1e1e] w-full max-w-lg max-h-[96vh] rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 flex flex-col"
                        >
                            <div className="bg-indigo-600 p-5 sm:p-10 text-white shrink-0">
                                <h3 className="text-xl sm:text-3xl font-black uppercase tracking-tight sm:tracking-tighter italic">Start Session</h3>
                                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] sm:tracking-[0.3em] mt-1.5 sm:mt-2 text-indigo-200">Activating {selectedRoom?.room_number}</p>
                            </div>

                            <form onSubmit={handleStartClass} className="p-5 sm:p-10 space-y-4 sm:space-y-6 overflow-y-auto">
                                {message.text && (
                                    <div className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
                                        <CheckCircle size={16}/>
                                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">{message.text}</span>
                                    </div>
                                )}

                                <div className="space-y-3 sm:space-y-6">
                                    <div className="space-y-1.5 sm:space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Faculty Name</label>
                                        <input className="w-full p-3 sm:p-4 bg-[#2a2a2a] border-none rounded-xl sm:rounded-2xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-80" placeholder="Enter faculty name" value={formData.faculty_name} onChange={e => setFormData({ ...formData, faculty_name: e.target.value })} disabled={isFaculty} required />
                                    </div>
                                    <div className="space-y-1.5 sm:space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Department</label>
                                        {isFaculty ? (
                                            <div className="w-full p-3 sm:p-4 bg-[#2a2a2a] border-none rounded-xl sm:rounded-2xl text-xs font-bold text-white">
                                                {storedDepartmentName || (datasets.departments || []).find(d => String(d.id) === String(formData.dept_id))?.name || 'Department not assigned'}
                                            </div>
                                        ) : (
                                            <select className="w-full p-3 sm:p-4 bg-[#2a2a2a] border-none rounded-xl sm:rounded-2xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.dept_id} onChange={e => setFormData({ ...formData, dept_id: e.target.value })} required>
                                                <option value="">Select Dept</option>
                                                {(datasets.departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        )}
                                    </div>
                                    <div className="space-y-1.5 sm:space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Subject</label>
                                        <input className="w-full p-3 sm:p-4 bg-[#2a2a2a] border-none rounded-xl sm:rounded-2xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter subject" value={formData.subject_name} onChange={e => setFormData({ ...formData, subject_name: e.target.value })} required />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Class Start Time</label>
                                            <input type="datetime-local" className="w-full p-3 sm:p-4 bg-[#2a2a2a] border-none rounded-xl sm:rounded-2xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.class_start_time} onChange={e => setFormData({ ...formData, class_start_time: e.target.value })} required />
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Class End Time</label>
                                            <input type="datetime-local" className="w-full p-3 sm:p-4 bg-[#2a2a2a] border-none rounded-xl sm:rounded-2xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.class_end_time} onChange={e => setFormData({ ...formData, class_end_time: e.target.value })} required />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 sm:gap-4 pt-3 sm:pt-8">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 sm:py-4 border-2 border-white/20 text-slate-200 rounded-xl sm:rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all">Cancel</button>
                                    <button type="submit" className="flex-1 py-3 sm:py-4 bg-indigo-600 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all">Confirm</button>
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
