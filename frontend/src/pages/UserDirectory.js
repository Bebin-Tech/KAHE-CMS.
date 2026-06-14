import React, { useEffect, useState } from 'react';
import API from '../api';

const UserDirectory = () => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchBar] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        faculty_id: '',
        role: 'faculty'
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const allUsersRes = await API.get('/users_list');
            setUsers(allUsersRes.data || []);
        } catch (err) {
            console.error("User fetch error:", err);
            if (err.response?.status === 401) {
                alert("Session expired. Please logout and login again.");
            }
        }
    };

    const handleCreateOrUpdate = async (e) => {
        if (e) e.preventDefault();
        try {
            console.log("Saving user with data:", formData);
            if (isEditing) {
                const res = await API.put(`/users/${selectedUser.id}`, formData);
                if (res.status === 200) alert('User updated successfully');
            } else {
                const res = await API.post('/users', formData);
                if (res.status === 200 || res.status === 201) alert('User created successfully');
            }
            setShowModal(false);
            fetchUsers();
        } catch (err) {
            console.error("Operation error:", err);
            if (err.response?.status === 401) {
                alert("Your session has expired. Please login again.");
                localStorage.clear();
                window.location.href = '/login';
            } else {
                const detail = err.response?.data?.detail;
                const message = typeof detail === 'string' ? detail : 'Operation failed';
                alert(message);
            }
        }
    };

    const handleDelete = async (id) => {
        if (!id) {
            alert("Error: Invalid User ID selection.");
            return;
        }
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                console.log(`CMS Security: Attempting to purge user identity ID=${id}`);
                const res = await API.delete(`/users/${id}`);
                fetchUsers();
                alert(res.data.detail || 'User identity purged successfully.');
            } catch (err) {
                console.error("purging failed:", err);
                const errorMessage = err.response?.data?.detail || ' purging failed due to institutional record dependencies or network error.';
                alert(errorMessage);
            }
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.faculty_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        active: users.length // Assuming all in db are active for now
    };

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-screen">
            <header className="mb-6 sm:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">User Directory</h1>
                    <p className="text-gray-500 font-medium mt-1 text-sm sm:text-base">Manage user accounts, roles and passwords</p>
                </div>
                <button
                    onClick={() => {
                        setIsEditing(false);
                        setFormData({ name: '', email: '', password: '', faculty_id: '', role: 'faculty' });
                        setShowModal(true);
                    }}
                    className="w-full sm:w-64 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center space-x-4 group"
                >
                    <div className="h-12 w-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Admin</p>
                        <p className="text-sm font-black text-gray-800">Create User</p>
                    </div>
                </button>
            </header>

            {/* Stats Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 mb-8 md:mb-10">
                {[
                    { label: 'TOTAL USERS', val: stats.total, color: 'text-indigo-600' },
                    { label: 'ADMINS', val: stats.admins, color: 'text-green-600' },
                    { label: 'ACTIVE', val: stats.active, color: 'text-blue-600' }
                ].map((s, idx) => (
                    <div key={idx} className="bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                        <p className={`text-3xl md:text-4xl font-black ${s.color}`}>{s.val}</p>
                        <p className="text-[10px] font-black text-gray-400 mt-2 tracking-widest">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-xl font-black text-gray-800">All Users</h2>
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Search user..."
                            className="bg-gray-50 border-none rounded-xl py-3 pl-10 pr-4 w-full focus:ring-2 focus:ring-indigo-500 font-medium outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchBar(e.target.value)}
                        />
                        <svg className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead>
                            <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <th className="p-4 md:p-6 w-16">#</th>
                                <th className="p-4 md:p-6">User</th>
                                <th className="p-4 md:p-6">Email</th>
                                <th className="p-4 md:p-6">Role</th>
                                <th className="p-4 md:p-6">Status</th>
                                <th className="p-4 md:p-6 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user, index) => (
                                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition group">
                                    <td className="p-4 md:p-6 text-gray-400 font-bold">{index + 1}</td>
                                    <td className="p-4 md:p-6">
                                        <div className="flex items-center space-x-4">
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-lg uppercase flex-shrink-0 ${
                                                user.role === 'admin' ? 'bg-green-600' : 'bg-violet-600'
                                            }`}>
                                                {user.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-black text-gray-800 leading-tight truncate">{user.name}</p>
                                                <p className="text-[10px] text-gray-400 font-bold truncate">@{user.faculty_id || 'user'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 md:p-6 text-gray-600 font-medium truncate max-w-[150px] md:max-w-none">{user.email}</td>
                                    <td className="p-4 md:p-6">
                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase border inline-block ${
                                            user.role === 'admin'
                                                ? 'bg-green-50 text-green-600 border-green-100'
                                                : 'bg-violet-50 text-violet-600 border-violet-100'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4 md:p-6">
                                        <div className="flex items-center space-x-2">
                                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                            <span className="text-xs font-bold text-gray-700">Active</span>
                                        </div>
                                    </td>
                                    <td className="p-4 md:p-6">
                                        <div className="flex justify-center space-x-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setFormData({ ...user, password: '' });
                                                    setIsEditing(true);
                                                    setShowModal(true);
                                                }}
                                                className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                            >
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                            >
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 z-50 transition-all duration-300 overflow-y-auto">
                    <div className="bg-white rounded-[2rem] md:rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-300 my-auto">
                        <div className="p-6 md:p-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
                            <div className="flex justify-between items-center mb-6 md:mb-8">
                                <h2 className="text-xl md:text-2xl font-black text-[#1e1b4b] tracking-tight">
                                    {isEditing ? 'Update User Account' : 'Create User Account'}
                                </h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-gray-400 hover:text-gray-600 transition"
                                >
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleCreateOrUpdate} className="space-y-4 md:space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                                    <input
                                        className="w-full p-4 bg-slate-50 border border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-gray-700 outline-none"
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">User ID (Username)</label>
                                    <input
                                        className="w-full p-4 bg-[#eff6ff] border border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-gray-700 outline-none"
                                        placeholder="Ex: admin_01"
                                        value={formData.faculty_id}
                                        onChange={(e) => setFormData({...formData, faculty_id: e.target.value})}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                                    <input
                                        type="email"
                                        className="w-full p-4 bg-slate-50 border border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-gray-700 outline-none"
                                        placeholder="Ex: john@kahe.edu"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        required
                                    />
                                </div>

                                {!isEditing && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                                        <input
                                            type="password"
                                            className="w-full p-4 bg-[#eff6ff] border border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-gray-700 outline-none"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                                            required
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Role</label>
                                    <div className="relative">
                                        <select
                                            className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:border-indigo-500 transition-all font-bold text-gray-700 outline-none appearance-none"
                                            value={formData.role}
                                            onChange={(e) => setFormData({...formData, role: e.target.value})}
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="faculty">Faculty</option>
                                            <option value="staff">Staff</option>
                                            <option value="accounts">Accounts</option>
                                            <option value="student">Student</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full border-2 border-indigo-900 text-[#1e1b4b] py-4 rounded-2xl font-bold hover:bg-slate-50 transition-colors uppercase tracking-wider mt-4"
                                >
                                    {isEditing ? 'Update Account' : 'Create Account'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDirectory;
