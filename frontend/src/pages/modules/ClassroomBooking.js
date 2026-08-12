import React, { useEffect, useState } from 'react';
import API from '../../api';
import { authGet } from '../../authSession';
import { formatISTDateTime } from '../../timeUtils';
import { Calendar, Clock, RefreshCw, Trash2 } from 'lucide-react';

const blockOptions = ['S-Block', 'P-Block', 'N-Block', 'E-Block', 'T-Block'];
const periodOptions = [
    { value: '1', label: '1st Period', time: '9:00 AM - 9:50 AM' },
    { value: '2', label: '2nd Period', time: '9:50 AM - 10:55 AM' },
    { value: '3', label: '3rd Period', time: '11:15 AM - 12:00 PM' },
    { value: '4', label: '4th Period', time: '12:00 PM - 12:45 PM' },
    { value: '5', label: '5th Period', time: '01:30 PM - 02:20 PM' },
    { value: '6', label: '6th Period', time: '02:20 PM - 03:10 PM' }
];

const formatDateTime = (value) => {
    return formatISTDateTime(value);
};

const todayISODate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const futureISODate = (daysAhead) => {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const ClassroomBooking = () => {
    const role = authGet('role')?.toLowerCase();
    const isAdmin = ['admin', 'super_admin'].includes(role);
    const currentUserId = authGet('user_id');
    const [activeBlock, setActiveBlock] = useState('S-Block');
    const [rooms, setRooms] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [recommendationLoading, setRecommendationLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [formData, setFormData] = useState({
        room: '',
        booking_date: todayISODate(),
        booking_mode: 'period',
        period: '',
        start_time: '',
        end_time: '',
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

    const fetchRecommendations = async (period = formData.period, bookingDate = formData.booking_date) => {
        const isCustom = formData.booking_mode === 'custom';
        if ((!isCustom && !period) || (isCustom && (!formData.start_time || !formData.end_time))) {
            setRecommendations([]);
            return;
        }
        setRecommendationLoading(true);
        try {
            const query = new URLSearchParams({
                block: activeBlock,
                booking_date: bookingDate,
                capacity: '60'
            });
            if (isCustom) {
                query.set('start_time', `${bookingDate}T${formData.start_time}:00`);
                query.set('end_time', `${bookingDate}T${formData.end_time}:00`);
            } else {
                query.set('period', period);
            }
            const res = await API.get(`/smart-room-recommendations/?${query.toString()}`);
            setRecommendations(Array.isArray(res.data?.recommendations) ? res.data.recommendations : []);
        } catch (err) {
            setRecommendations([]);
            console.error('AI room recommendation failed.', err.response?.data || err.message);
        } finally {
            setRecommendationLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeBlock]);

    useEffect(() => {
        fetchRecommendations(formData.period, formData.booking_date);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeBlock, formData.period, formData.booking_date, formData.booking_mode, formData.start_time, formData.end_time]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ text: '', type: '' });
        if (!formData.booking_date) {
            setSaving(false);
            setMessage({ text: 'Please select a booking date.', type: 'error' });
            return;
        }
        if (formData.booking_mode === 'period' && !formData.period) {
            setSaving(false);
            setMessage({ text: 'Please select a booking period.', type: 'error' });
            return;
        }
        if (formData.booking_mode === 'custom' && (!formData.start_time || !formData.end_time)) {
            setSaving(false);
            setMessage({ text: 'Please select custom start and end time.', type: 'error' });
            return;
        }
        if (formData.booking_mode === 'custom' && formData.end_time <= formData.start_time) {
            setSaving(false);
            setMessage({ text: 'End time must be after start time.', type: 'error' });
            return;
        }
        try {
            const payload = {
                room: Number(formData.room),
                purpose: formData.purpose
            };
            if (formData.booking_mode === 'custom') {
                payload.start_time = `${formData.booking_date}T${formData.start_time}:00`;
                payload.end_time = `${formData.booking_date}T${formData.end_time}:00`;
            } else {
                payload.booking_date = formData.booking_date;
                payload.period = formData.period;
            }
            await API.post('/bookings/', payload);
            setMessage({ text: 'Classroom booked successfully.', type: 'success' });
            await fetchData();
            await fetchRecommendations(formData.period, formData.booking_date);
        } catch (err) {
            setMessage({ text: getApiError(err, 'Classroom booking failed.'), type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const canManageBooking = (booking) => isAdmin || String(booking.user) === String(currentUserId);

    const handleDeleteBooking = async (booking) => {
        const actionLabel = isAdmin ? 'delete' : 'cancel';
        if (!window.confirm(`Do you want to ${actionLabel} the booking for ${booking.room_number}?`)) return;
        setMessage({ text: '', type: '' });
        try {
            await API.delete(`/bookings/${booking.id}/`);
            setMessage({ text: isAdmin ? 'Booking deleted successfully.' : 'Booking cancelled successfully.', type: 'success' });
            await fetchData();
        } catch (err) {
            setMessage({ text: getApiError(err, isAdmin ? 'Booking delete failed.' : 'Booking cancel failed.'), type: 'error' });
        }
    };

    return (
        <div className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 space-y-8 bg-slate-50">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tightest uppercase italic">
                        Classroom <span className="text-indigo-600">Booking</span>
                    </h1>
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
                        <p className="text-sm font-semibold text-slate-600 mt-1">Choose a future date, room, and period to reserve a classroom.</p>
                    </div>

                    <label className="space-y-2 block">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Booking Date</span>
                        <input
                            type="date"
                            min={todayISODate()}
                            max={futureISODate(14)}
                            className="w-full p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={formData.booking_date}
                            onChange={e => setFormData({ ...formData, booking_date: e.target.value })}
                            required
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { key: 'period', label: 'Period' },
                            { key: 'custom', label: 'Custom Time' }
                        ].map(mode => (
                            <button
                                key={mode.key}
                                type="button"
                                onClick={() => setFormData({ ...formData, booking_mode: mode.key })}
                                className={`rounded-xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${formData.booking_mode === mode.key ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300 hover:text-indigo-700'}`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>

                    <label className="space-y-2 block">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Classroom</span>
                        <select className="w-full p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.room} onChange={e => setFormData({ ...formData, room: e.target.value })} required>
                            {rooms.map(room => (
                                <option key={room.id} value={room.id}>
                                    {room.block_name || room.building} - {room.room_number} (Current: {room.status})
                                </option>
                            ))}
                        </select>
                    </label>

                    {formData.booking_mode === 'period' ? (
                    <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Select Period</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {periodOptions.map(period => {
                                const selected = formData.period === period.value;
                                return (
                                    <button
                                        key={period.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, period: period.value })}
                                        className={`min-h-[82px] rounded-xl border p-3 text-left transition-all ${selected ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-300 text-slate-800 hover:border-indigo-400 hover:bg-indigo-50'}`}
                                        aria-pressed={selected}
                                    >
                                        <span className="block text-[10px] font-black uppercase tracking-widest">{period.label}</span>
                                        <span className={`mt-2 block text-[10px] font-black uppercase tracking-wide ${selected ? 'text-indigo-100' : 'text-slate-500'}`}>{period.time}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="space-y-2 block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Start Time</span>
                            <input
                                type="time"
                                className="w-full p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                value={formData.start_time}
                                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                required={formData.booking_mode === 'custom'}
                            />
                        </label>
                        <label className="space-y-2 block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">End Time</span>
                            <input
                                type="time"
                                className="w-full p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                value={formData.end_time}
                                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                required={formData.booking_mode === 'custom'}
                            />
                        </label>
                    </div>
                    )}

                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-black uppercase text-slate-900">AI Suggested Rooms</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">CSP + GA best fit by availability, capacity, and recent usage</p>
                            </div>
                            {recommendationLoading && <RefreshCw className="animate-spin text-indigo-600" size={18} />}
                        </div>
                        {(formData.booking_mode === 'period' && !formData.period) || (formData.booking_mode === 'custom' && (!formData.start_time || !formData.end_time)) ? (
                            <p className="text-xs font-bold text-slate-600">
                                {formData.booking_mode === 'custom' ? 'Select a date, start time, and end time to get AI room recommendations.' : 'Select a date and period to get AI room recommendations.'}
                            </p>
                        ) : recommendations.length === 0 && !recommendationLoading ? (
                            <p className="text-xs font-bold text-slate-600">No recommended rooms are available for this period.</p>
                        ) : (
                            <div className="space-y-2">
                                {recommendations.slice(0, 3).map(room => (
                                    <button
                                        key={room.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, room: String(room.id) })}
                                        className={`w-full text-left rounded-xl border p-3 transition-all ${String(formData.room) === String(room.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-black">{room.block_name} - {room.room_number}</span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${String(formData.room) === String(room.id) ? 'text-indigo-100' : 'text-indigo-700'}`}>Score {room.ai_score}</span>
                                        </div>
                                        <p className={`mt-1 text-[10px] font-bold ${String(formData.room) === String(room.id) ? 'text-indigo-100' : 'text-slate-500'}`}>
                                            {(room.reasons || []).slice(0, 2).join(' • ')}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
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
                                            {formatDateTime(booking.start_time)} - {formatDateTime(booking.end_time)} IST
                                        </div>
                                        {canManageBooking(booking) && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteBooking(booking)}
                                                className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-100"
                                            >
                                                <Trash2 size={14} />
                                                {isAdmin ? 'Delete' : 'Cancel'}
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
