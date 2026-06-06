import React, { useEffect, useState } from 'react';
import API from '../api';

const FacultyManagement = () => {
    const [faculty, setFaculty] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [newFaculty, setNewFaculty] = useState({
        name: '',
        email: '',
        password: '',
        faculty_id: '',
        role: 'faculty'
    });

    useEffect(() => {
        fetchFaculty();
    }, []);

    const fetchFaculty = async () => {
        try {
            const res = await API.get('/faculty');
            setFaculty(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await API.post('/users', newFaculty);
            setShowModal(false);
            setNewFaculty({ name: '', email: '', password: '', faculty_id: '', role: 'faculty' });
            fetchFaculty();
            alert('Faculty account created successfully');
        } catch (err) {
            alert('Failed to create account');
        }
    };

    return (
        <div className="p-10 bg-gray-50 min-h-screen">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Faculty Management</h1>
                    <p className="text-gray-600 font-medium">Manage and generate institutional faculty accounts.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition"
                >
                    + Create Faculty
                </button>
            </header>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Faculty ID</th>
                            <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                            <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Email</th>
                            <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {faculty.map((f) => (
                            <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                <td className="p-6 font-black text-indigo-600">{f.faculty_id}</td>
                                <td className="p-6 font-bold text-gray-800">{f.name}</td>
                                <td className="p-6 text-gray-500 font-medium">{f.email}</td>
                                <td className="p-6">
                                    <button className="text-gray-400 hover:text-red-600 transition p-2">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="bg-indigo-600 p-8 text-white">
                            <h2 className="text-2xl font-black text-center">New Faculty Account</h2>
                        </div>
                        <form onSubmit={handleCreate} className="p-8 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Faculty ID</label>
                                <input
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold outline-none"
                                    value={newFaculty.faculty_id}
                                    onChange={(e) => setNewFaculty({...newFaculty, faculty_id: e.target.value})}
                                    required
                                    placeholder="e.g. FAC101"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                                <input
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold outline-none"
                                    value={newFaculty.name}
                                    onChange={(e) => setNewFaculty({...newFaculty, name: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Institutional Email</label>
                                <input
                                    type="email"
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold outline-none"
                                    value={newFaculty.email}
                                    onChange={(e) => setNewFaculty({...newFaculty, email: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                                <input
                                    type="password"
                                    className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold outline-none"
                                    value={newFaculty.password}
                                    onChange={(e) => setNewFaculty({...newFaculty, password: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 font-black text-gray-400">Cancel</button>
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FacultyManagement;
