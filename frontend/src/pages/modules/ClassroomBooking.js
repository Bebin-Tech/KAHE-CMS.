import React, { useEffect, useState } from 'react';
import API from '../../api';
import { authGet } from '../../authSession';
import { Calendar, Clock, RefreshCw, Trash2 } from 'lucide-react';

const blockOptions = ['S-Block', 'P-Block', 'N-Block', 'E-Block'];

const toDateTimeLocal = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

const ClassroomBooking = () => {
    const role = authGet('role')?.toLowerCase();
    const isAdmin = ['admin', 'super_admin'].includes(role);
    const [activeBlock, setActiveBlock] = useState('S-Block');
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const startDefault = new Date();
    startDefault.setMinutes(0, 0, 0);
    startDefault.setHours(startDefault.getHours() + 1);
    const endDefault = new Date(startDefault.getTime() + 60 * 60 * 1000);

    const [formData, setFormData] = useState({
        room: '',
        start_time: toDateTimeLocal(startDefault),
        end_time: toDateTimeLocal(endDefault),
        purpose: ''
    });

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
        const [, value] = firstError;
        return Array.isArray(value) ? value.join(', ') : String(value);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const roomRequest = API.get(`/live-rooms/?block=${encodeURIComponent(activeBlock)}`)
                .catch(err => {
                    if (err.response?.status !== 404) throw err;
                    return API.get(`/rooms/?block=${encodeURIComponent(activeBlock)}`);
                });
            const [roomRes, bookingRes] = await Promise.all([
                roomRequest,
                API.get(`/bookings/?block=${encodeURIComponent(activeBlock)}`)
            ]);
            const nextRooms = Array.isArray(roomRes.data) ? roomRes.data : [];
            setRooms(nextRooms);
            setBookings(Array.isArray(bookingRes.data) ? bookingRes.data : []);
            setFormData(prev => ({
                ...prev,
                room: prev.room && nextRooms.some(room => String(room.id) === String(prev.room))
                    ? prev.room
                    : String(nextRooms[0]?.id || '')
            }));
        } catch (err) {
            setMessage({ text: getApiError(err, 'Booking data sync failed.'), type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeBlock]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ text: '', type: '' });
        try {
            await API.post('/bookings/', {
                room: Number(formData.room),
                start_time: formData.start_time,
                end_time: formData.end_time,
                purpose: formData.purpose
            });
            setMessage({ text: 'Classroom booked successfully.', type: 'success' });
            await fetchData();
        } catch (err) {
            setMessage({ text: getApiError(err, 'Classroom booking failed.'), type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteBooking = async (booking) => {
        if (!window.confirm(`Delete booking for ${booking.room_number}?`)) return;
        setMessage({ text: '', type: '' });
        try {
            await API.delete(`/bookings/${booking.id}/`);
            setMessage({ text: 'Booking deleted successfully.', type: 'success' });
            await fetchData();
        } catch (err) {
            setMessage({ text: getApiError(err, 'Booking delete failed.'), type: 'error' });
        }
    };

    return (
        <div className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 space-y-8 bg-slate-50">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tightest uppercase italic">
                        Classroom <span className="text-indigo-600">Booking</span>
                    </h1>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-2">
                            {isAdmin ? 'View and manage all classroom bookings' : 'Reserve classrooms by date and time'}
                        </p>
                </div>
                <button onClick={fetchData} className="px-5 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm">
                    <RefreshCw size={15} />
                    Refresh
                </button>
            </header>

            <div className="flex flex-wrap gap-3">
                {blockOptions.map(block => (
                    <button
                        key={block}
                        onClick={() => setActiveBlock(block)}
                        className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${activeBlock === block ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-700 border-slate-300 hover:text-indigo-700 hover:border-indigo-300'}`}
                    >
                        {block}
                    </button>
                ))}
            </div>

            {message.text && (
                <div className={`p-4 rounded-2xl text-xs font-black uppercase tracking-widest border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    {message.text}
                </div>
            )}

            <section className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 space-y-5">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 uppercase">Book a Classroom</h2>
                        <p className="text-sm font-semibold text-slate-600 mt-1">Choose a room and reserve the required time slot.</p>
                    </div>

                    <label className="space-y-2 block">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Classroom</span>
                        <select className="w-full p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.room} onChange={e => setFormData({ ...formData, room: e.target.value })} required>
                            {rooms.map(room => (
                                <option key={room.id} value={room.id}>
                                    {room.block_name || room.building} - {room.room_number} ({room.status})
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="space-y-2 block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Start Time</span>
                            <input type="datetime-local" className="w-full p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} required />
                        </label>
                        <label className="space-y-2 block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">End Time</span>
                            <input type="datetime-local" className="w-full p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} required />
                        </label>
                    </div>

                    <label className="space-y-2 block">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Purpose</span>
                        <textarea className="w-full min-h-28 p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Enter booking purpose" value={formData.purpose} onChange={e => setFormData({ ...formData, purpose: e.target.value })} />
                    </label>

                    <button disabled={saving || loading || rooms.length === 0} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest disabled:opacity-50">
                        {saving ? 'Booking...' : 'Confirm Booking'}
                    </button>
                </form>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
                    <div className="p-6 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-900 uppercase">{activeBlock} Bookings</h2>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">{bookings.length} upcoming reservations</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 flex items-center justify-center text-indigo-600">
                            <RefreshCw className="animate-spin" size={28} />
                        </div>
                    ) : bookings.length === 0 ? (
                        <div className="p-12 text-center">
                            <Calendar className="mx-auto text-slate-500 mb-3" size={36} />
                            <p className="text-xs font-black text-slate-600 uppercase tracking-widest">No bookings found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {bookings.map(booking => (
                                <div key={booking.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">{booking.block_name} - {booking.room_number}</p>
                                        <p className="text-xs font-bold text-slate-600 mt-1">Booked by {booking.user_name}</p>
                                        {booking.purpose && <p className="text-xs font-semibold text-slate-500 mt-1">{booking.purpose}</p>}
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-black uppercase tracking-widest">
                                            <Clock size={14} />
                                            {formatDateTime(booking.start_time)} - {formatDateTime(booking.end_time)}
                                        </div>
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteBooking(booking)}
                                                className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-100"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default ClassroomBooking;
