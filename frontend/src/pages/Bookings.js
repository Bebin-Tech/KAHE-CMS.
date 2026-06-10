import React, { useEffect, useState } from 'react';
import API from '../api';

const Bookings = () => {
    const [bookings, setBookings] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const role = localStorage.getItem('role');

    const [newBooking, setNewBooking] = useState({
        room_id: '', faculty_name: '', department: '', start_time: '', end_time: ''
    });

    const [editBooking, setEditBooking] = useState({
        room_id: '', faculty_name: '', department: '', start_time: '', end_time: ''
    });

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const rRes = await API.get('/rooms');
            setRooms(rRes.data || []);
            const bRes = await API.get('/bookings');
            setBookings(bRes.data || []);
        } catch (err) {
            console.error("Data fetch failed:", err);
        }
    };

    const handleBook = async (e) => {
        if (e) e.preventDefault();
        try {
            const data = { ...newBooking, room_id: parseInt(newBooking.room_id) };
            const response = await API.post('/book-room', data);
            if (response.status === 200 || response.status === 201) {
                setShowModal(false);
                setNewBooking({ room_id: '', faculty_name: '', department: '', start_time: '', end_time: '' });
                fetchData();
                alert('Booking successful!');
            }
        } catch (err) {
            console.error("Booking error:", err);
            const detail = err.response?.data?.detail;
            let errorMsg = 'Booking failed. Please try again.';
            if (typeof detail === 'string') errorMsg = detail;
            else if (err.response?.status === 401) errorMsg = "Unauthorized: Please login again.";
            alert(errorMsg);
        }
    };

    const handleUpdateBooking = async (e) => {
        if (e) e.preventDefault();
        try {
            console.log("Updating booking with data:", editBooking);
            const data = { ...editBooking, room_id: parseInt(editBooking.room_id) };
            const res = await API.put(`/bookings/${selectedBooking.id}`, data);
            if (res.status === 200) {
                setShowEditModal(false);
                fetchData();
                alert('Booking updated successfully!');
            }
        } catch (err) {
            console.error("Update booking error:", err);
            const detail = err.response?.data?.detail;
            alert(typeof detail === 'string' ? detail : 'Update failed');
        }
    };

    const handleDeleteBooking = async (id) => {
        if (window.confirm('Are you sure you want to permanentely delete this booking?')) {
            try {
                await API.delete(`/bookings/${id}`);
                fetchData();
                alert('Booking deleted successfully.');
            } catch (err) {
                console.error("Delete booking error:", err);
                alert('Delete failed');
            }
        }
    };

    const departments = ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS (Artificial Intelligence and Data Science)"];

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-screen">
            <header className="mb-6 sm:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">CR Booking</h1>
                    <p className="text-gray-600 font-medium text-sm sm:text-base">Manage and schedule classroom reservations.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition flex items-center justify-center space-x-2"
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
                                {role === 'admin' && <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>}
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
                                    {role === 'admin' && (
                                        <td className="p-6">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => { setSelectedBooking(b); setEditBooking(b); setShowEditModal(true); }}
                                                    className="text-indigo-600 hover:text-indigo-800 transition p-2 hover:bg-indigo-50 rounded-xl"
                                                    title="Edit Booking"
                                                >
                                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteBooking(b.id)}
                                                    className="text-red-500 hover:text-red-700 transition p-2 hover:bg-red-50 rounded-xl"
                                                    title="Delete Booking"
                                                >
                                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {bookings.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-20 text-center text-gray-400 font-medium">No bookings found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: New Booking */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 z-50 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg my-auto shadow-2xl animate-in fade-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 p-8 text-white relative flex-shrink-0">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-black tracking-tight uppercase text-center">New Reservation</h2>
                                <p className="text-indigo-100 font-bold opacity-80 mt-1 uppercase tracking-widest text-[10px] text-center">Secure Room Booking</p>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 custom-scrollbar bg-white p-4 sm:p-8">
                            <form onSubmit={handleBook} id="bookingForm" className="space-y-4 sm:space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Faculty Name</label>
                                    <input
                                        className="w-full p-3 sm:p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none text-sm"
                                        placeholder="Full Name"
                                        onChange={(e) => setNewBooking({...newBooking, faculty_name: e.target.value})}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Department</label>
                                    <select
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none appearance-none"
                                        onChange={(e) => setNewBooking({...newBooking, department: e.target.value})}
                                        required
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Class Room</label>
                                    <select
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none appearance-none"
                                        onChange={(e) => setNewBooking({...newBooking, room_id: e.target.value})}
                                        required
                                    >
                                        <option value="">Choose a classroom...</option>
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.room_number} ({r.type})</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Start Time</label>
                                        <input
                                            type="datetime-local"
                                            className="w-full p-3 sm:p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none text-sm"
                                            onChange={(e) => setNewBooking({...newBooking, start_time: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">End Time</label>
                                        <input
                                            type="datetime-local"
                                            className="w-full p-3 sm:p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none text-sm"
                                            onChange={(e) => setNewBooking({...newBooking, end_time: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-8 bg-white border-t border-gray-50 flex gap-4 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="flex-1 font-black text-gray-400 py-4 hover:bg-gray-50 rounded-2xl transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="bookingForm"
                                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition"
                            >
                                Confirm Booking
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Booking */}
            {showEditModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 z-50 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg my-auto shadow-2xl animate-in fade-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 p-8 text-white relative flex-shrink-0">
                            <h2 className="text-2xl font-black text-center uppercase tracking-tight">Edit Reservation</h2>
                        </div>
                        <div className="overflow-y-auto flex-1 bg-white p-8">
                            <form onSubmit={handleUpdateBooking} id="editBookingForm" className="space-y-5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Faculty Name</label>
                                    <input
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none"
                                        value={editBooking.faculty_name}
                                        onChange={(e) => setEditBooking({...editBooking, faculty_name: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Department</label>
                                    <select
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none appearance-none"
                                        value={editBooking.department}
                                        onChange={(e) => setEditBooking({...editBooking, department: e.target.value})}
                                        required
                                    >
                                        <option value="">Select Dept</option>
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Room</label>
                                    <select
                                        className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800 outline-none appearance-none"
                                        value={editBooking.room_id}
                                        onChange={(e) => setEditBooking({...editBooking, room_id: e.target.value})}
                                        required
                                    >
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.room_number}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Start Time</label>
                                        <input
                                            type="datetime-local"
                                            className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold outline-none"
                                            value={editBooking.start_time ? new Date(new Date(editBooking.start_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                            onChange={(e) => setEditBooking({...editBooking, start_time: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">End Time</label>
                                        <input
                                            type="datetime-local"
                                            className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold outline-none"
                                            value={editBooking.end_time ? new Date(new Date(editBooking.end_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                            onChange={(e) => setEditBooking({...editBooking, end_time: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="p-8 bg-white border-t flex gap-4 flex-shrink-0">
                            <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 font-black text-gray-400">Cancel</button>
                            <button type="submit" form="editBookingForm" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Bookings;
