import React, { useEffect, useState } from 'react';
import API from '../api';

const Bookings = () => {
    const [bookings, setBookings] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const role = localStorage.getItem('role');

    const [newBooking, setNewBooking] = useState({
        room_id: '', faculty_name: '', department: '', start_time: '', end_time: ''
    });

    const [editBooking, setEditBooking] = useState({
        room_id: '', faculty_name: '', department: '', start_time: '', end_time: ''
    });

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [rRes, bRes] = await Promise.all([
                API.get('/rooms'),
                API.get('/bookings')
            ]);
            setRooms(Array.isArray(rRes.data) ? rRes.data : []);
            setBookings(Array.isArray(bRes.data) ? bRes.data : []);
            setLoading(false);
        } catch (err) {
            console.error("Data fetch failed:", err);
            setLoading(false);
        }
    };

    const handleBook = async (e) => {
        if (e) e.preventDefault();
        try {
            const data = { ...newBooking, room_id: parseInt(newBooking.room_id) };
            await API.post('/book-room', data);
            setShowModal(false);
            setNewBooking({ room_id: '', faculty_name: '', department: '', start_time: '', end_time: '' });
            fetchData();
            alert('Booking successful!');
        } catch (err) {
            alert(err.response?.data?.detail || 'Booking failed');
        }
    };

    const handleDeleteBooking = async (id) => {
        if (window.confirm('Delete this booking?')) {
            try {
                await API.delete(`/bookings/${id}`);
                fetchData();
                alert('Booking deleted');
            } catch (err) {
                alert('Delete failed');
            }
        }
    };

    const departments = ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS (Artificial Intelligence and Data Science)"];

    if (loading) return <div className="p-10 text-center animate-pulse font-black text-gray-400">LOADING BOOKINGS...</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-screen">
            <header className="mb-6 sm:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">CR Booking</h1>
                    <p className="text-gray-600 font-medium text-sm sm:text-base">Manage and schedule classroom reservations.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="w-full sm:w-64 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center space-x-4 group"
                >
                    <div className="h-12 w-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</p>
                        <p className="text-sm font-black text-gray-800">Book a Room</p>
                    </div>
                </button>
            </header>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <th className="p-6">Room Number</th>
                                <th className="p-6">Faculty Name</th>
                                <th className="p-6">Timing</th>
                                <th className="p-6">Status</th>
                                {role === 'admin' && <th className="p-6 text-center">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.isArray(bookings) && bookings.map((b) => (
                                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                    <td className="p-6 font-bold text-gray-800">
                                        {rooms.find(r => r?.id === b?.room_id)?.room_number || `Room ${b?.room_id}`}
                                    </td>
                                    <td className="p-6 font-medium text-gray-700">{b?.faculty_name}</td>
                                    <td className="p-6">
                                        <p className="text-xs font-bold text-gray-700">{new Date(b?.start_time).toLocaleDateString()}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(b?.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(b?.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                    </td>
                                    <td className="p-6">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest border uppercase ${
                                            b?.status === 'QUEUED' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100'
                                        }`}>{b?.status}</span>
                                    </td>
                                    {role === 'admin' && (
                                        <td className="p-6">
                                            <div className="flex justify-center space-x-2">
                                                <button onClick={() => { setSelectedBooking(b); setEditBooking(b); }} className="text-indigo-600 font-bold text-xs hover:underline">Edit</button>
                                                <button onClick={() => handleDeleteBooking(b.id)} className="text-red-500 font-bold text-xs hover:underline">Remove</button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {bookings.length === 0 && <tr><td colSpan="5" className="p-20 text-center text-gray-400 italic">No bookings found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: New Booking */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-indigo-600 p-8 text-white text-center"><h2 className="text-2xl font-black uppercase tracking-tight">New Reservation</h2></div>
                        <form onSubmit={handleBook} className="p-8 space-y-6">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Faculty Name</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={newBooking.faculty_name} onChange={(e) => setNewBooking({...newBooking, faculty_name: e.target.value})} required/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Department</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none" value={newBooking.department} onChange={(e) => setNewBooking({...newBooking, department: e.target.value})} required><option value="">Select Dept</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Class Room</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none" value={newBooking.room_id} onChange={(e) => setNewBooking({...newBooking, room_id: e.target.value})} required><option value="">Select Room</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.room_number}</option>)}</select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Start Time</label><input type="datetime-local" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" onChange={(e) => setNewBooking({...newBooking, start_time: e.target.value})} required/></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">End Time</label><input type="datetime-local" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" onChange={(e) => setNewBooking({...newBooking, end_time: e.target.value})} required/></div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border-2 border-gray-100 text-gray-400 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-50 transition">Cancel</button>
                                <button type="submit" className="flex-1 border-2 border-indigo-600 text-indigo-600 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition">Confirm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Bookings;
