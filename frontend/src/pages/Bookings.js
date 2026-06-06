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
        e.preventDefault();
        try {
            const data = { ...newBooking, room_id: parseInt(newBooking.room_id) };
            await API.post('/book-room', data);
            setShowModal(false);
            fetchData();
            alert('Booking successful!');
        } catch (err) {
            alert(err.response?.data?.detail || 'Booking failed');
        }
    };

    const handleUpdateBooking = async (e) => {
        e.preventDefault();
        try {
            const data = { ...editBooking, room_id: parseInt(editBooking.room_id) };
            await API.put(`/bookings/${selectedBooking.id}`, data);
            setShowEditModal(false);
            fetchData();
            alert('Booking updated!');
        } catch (err) {
            alert(err.response?.data?.detail || 'Update failed');
        }
    };

    const handleDeleteBooking = async (id) => {
        if (window.confirm('Delete this booking?')) {
            try {
                await API.delete(`/bookings/${id}`);
                fetchData();
                alert('Booking deleted.');
            } catch (err) {
                alert('Delete failed');
            }
        }
    };

    const departments = ["Languages", "Computer Science", "Mathematics", "General Education", "AI & DS"];

    return (
        <div className="p-10 bg-gray-50 min-h-screen">
            <header className="mb-10 flex justify-between items-center">
                <div><h1 className="text-4xl font-black text-gray-900 tracking-tight">Room Bookings</h1><p className="text-gray-600 font-medium">Manage and schedule classroom reservations.</p></div>
                <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition flex items-center space-x-2"><span>Book a Room</span></button>
            </header>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead><tr className="bg-gray-50 border-b border-gray-100"><th className="p-6 text-[10px] font-black text-gray-400 uppercase">Room</th><th className="p-6 text-[10px] font-black text-gray-400 uppercase">Faculty</th><th className="p-6 text-[10px] font-black text-gray-400 uppercase">Timing</th><th className="p-6 text-[10px] font-black text-gray-400 uppercase">Status</th>{role === 'admin' && <th className="p-6 text-[10px] font-black text-gray-400 uppercase">Actions</th>}</tr></thead>
                        <tbody>
                            {bookings.map((b) => (
                                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                    <td className="p-6 font-bold">{rooms.find(r => r.id === b.room_id)?.room_number || b.room_id}</td>
                                    <td className="p-6"><div className="flex flex-col"><span className="font-bold text-gray-800">{b.faculty_name}</span><span className="text-[10px] text-indigo-500 font-black uppercase">{b.department}</span></div></td>
                                    <td className="p-6 text-sm font-bold text-gray-700">{new Date(b.start_time).toLocaleString()}</td>
                                    <td className="p-6"><span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">{b.status}</span></td>
                                    {role === 'admin' && <td className="p-6 flex space-x-2"><button onClick={() => { setSelectedBooking(b); setEditBooking(b); setShowEditModal(true); }} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-xl">Edit</button><button onClick={() => handleDeleteBooking(b.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-xl">Delete</button></td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: New Booking */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="bg-indigo-600 p-8 text-white"><h2 className="text-2xl font-black text-center uppercase">New Reservation</h2></div>
                        <form onSubmit={handleBook} className="p-8 space-y-4">
                            <input className="w-full p-4 bg-gray-50 rounded-2xl outline-none" placeholder="Faculty Name" onChange={(e) => setNewBooking({...newBooking, faculty_name: e.target.value})} required/>
                            <select className="w-full p-4 bg-gray-50 rounded-2xl outline-none" onChange={(e) => setNewBooking({...newBooking, department: e.target.value})} required><option value="">Select Department</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select>
                            <select className="w-full p-4 bg-gray-50 rounded-2xl outline-none" onChange={(e) => setNewBooking({...newBooking, room_id: e.target.value})} required><option value="">Select Room</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.room_number}</option>)}</select>
                            <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black text-gray-400 ml-1">START</label><input type="datetime-local" className="w-full p-4 bg-gray-50 rounded-2xl outline-none" onChange={(e) => setNewBooking({...newBooking, start_time: e.target.value})} required/></div><div><label className="text-[10px] font-black text-gray-400 ml-1">END</label><input type="datetime-local" className="w-full p-4 bg-gray-50 rounded-2xl outline-none" onChange={(e) => setNewBooking({...newBooking, end_time: e.target.value})} required/></div></div>
                            <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowModal(false)} className="flex-1 font-black text-gray-400">Cancel</button><button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">Confirm</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Edit Booking */}
            {showEditModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="bg-indigo-600 p-8 text-white"><h2 className="text-2xl font-black text-center uppercase">Edit Reservation</h2></div>
                        <form onSubmit={handleUpdateBooking} className="p-8 space-y-4">
                            <input className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value={editBooking.faculty_name} onChange={(e) => setEditBooking({...editBooking, faculty_name: e.target.value})} required/>
                            <select className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value={editBooking.department} onChange={(e) => setEditBooking({...editBooking, department: e.target.value})} required><option value="">Select Dept</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select>
                            <select className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value={editBooking.room_id} onChange={(e) => setEditBooking({...editBooking, room_id: e.target.value})} required>{rooms.map(r => <option key={r.id} value={r.id}>{r.room_number}</option>)}</select>
                            <div className="flex gap-4 pt-4"><button type="button" onClick={() => setShowEditModal(false)} className="flex-1 font-black text-gray-400">Cancel</button><button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">Save Changes</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Bookings;
