import React, { useEffect, useState } from 'react';
import API from '../api';

const Bookings = () => {
    const [bookings, setBookings] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [newBooking, setNewBooking] = useState({
        room_id: '',
        faculty_name: '',
        department: '',
        start_time: '',
        end_time: ''
    });

    useEffect(() => {
        fetchData();
        // Refresh every 10 seconds for live updates
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    // Also fetch when modal opens
    useEffect(() => {
        if (showModal) fetchData();
    }, [showModal]);

    const fetchData = async () => {
        try {
            // Fetch rooms independently to ensure the dropdown always works
            const rRes = await API.get('/rooms');
            setRooms(rRes.data || []);

            // Then fetch bookings
            const bRes = await API.get('/bookings');
            setBookings(bRes.data || []);
        } catch (err) {
            console.error("Data fetch failed:", err);
            // Don't crash, just log and handle status codes
            if (err.response?.status === 401) {
                alert("Session expired. Please logout and login again.");
            }
        }
    };

    const handleBook = async (e) => {
        e.preventDefault();
        try {
            // Ensure room_id is sent as an integer
            const bookingToSubmit = {
                ...newBooking,
                room_id: parseInt(newBooking.room_id)
            };
            await API.post('/book-room', bookingToSubmit);
            setShowModal(false);
            fetchData();
            alert('Booking successful!');
        } catch (err) {
            console.error("Booking error details:", err.response?.data);
            alert(err.response?.data?.detail || 'Booking failed. Try logging out and back in.');
        }
    };

    const departments = [
        "Languages",
        "Computer Science",
        "Mathematics",
        "General Education",
        "AI & DS (Artificial Intelligence and Data Science)"
    ];

    return (
        <div className="p-10 bg-gray-50 min-h-screen">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Room Bookings</h1>
                    <p className="text-gray-600 font-medium">Manage and schedule classroom reservations.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition flex items-center space-x-2"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Book a Room</span>
                </button>
            </header>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Room Number</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Faculty Name</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Timing</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bookings.map((b) => (
                                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                    <td className="p-6">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-black text-xs">
                                                {rooms.find(r => r.id === b.room_id)?.room_number.charAt(0) || 'R'}
                                            </div>
                                            <span className="font-bold text-gray-800">
                                                {rooms.find(r => r.id === b.room_id)?.room_number || `Room ${b.room_id}`}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className="font-bold text-gray-700">{b.faculty_name}</span>
                                    </td>
                                    <td className="p-6">
                                        <p className="text-sm font-bold text-gray-700">{new Date(b.start_time).toLocaleDateString()}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">
                                            {new Date(b.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(b.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </p>
                                    </td>
                                    <td className="p-6">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border uppercase ${
                                            b.status === 'QUEUED' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100'
                                        }`}>
                                            {b.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {bookings.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="p-20 text-center text-gray-400 font-medium">No bookings found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 my-auto">
                        <div className="bg-indigo-600 p-8 text-white">
                            <h2 className="text-2xl font-black text-center uppercase tracking-tight">Room Reservation</h2>
                        </div>
                        <form onSubmit={handleBook} className="p-8 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Faculty Name</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none"
                                        value={newBooking.faculty_name}
                                        onChange={(e) => setNewBooking({...newBooking, faculty_name: e.target.value})}
                                        required
                                        placeholder="Full Name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Department</label>
                                    <div className="relative">
                                        <select
                                            className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none appearance-none"
                                            value={newBooking.department}
                                            onChange={(e) => setNewBooking({...newBooking, department: e.target.value})}
                                            required
                                        >
                                            <option value="">Select Dept</option>
                                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Room</label>
                                <div className="relative">
                                    <select
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none appearance-none"
                                        value={newBooking.room_id}
                                        onChange={(e) => setNewBooking({...newBooking, room_id: e.target.value})}
                                        required
                                    >
                                        <option value="">Choose a classroom...</option>
                                        {rooms.map(r => (
                                            <option key={r.id} value={r.id}>{r.room_number} ({r.type})</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Start Time</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none"
                                        onChange={(e) => setNewBooking({...newBooking, start_time: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">End Time</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none"
                                        onChange={(e) => setNewBooking({...newBooking, end_time: e.target.value})}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 font-black text-gray-400 py-4 hover:bg-gray-50 rounded-2xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition"
                                >
                                    Confirm Booking
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Bookings;
