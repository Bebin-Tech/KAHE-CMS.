import React, { useEffect, useState, useCallback } from 'react';
import API from '../api';
import {
    Users,
    UserCheck,
    UserX,
    ShieldCheck,
    GraduationCap,
    Briefcase,
    Search,
    Plus,
    Edit2,
    Trash2,
    X,
    Phone,
    Mail,
    Building2,
    Clock
} from 'lucide-react';

const UserDirectory = () => {
    const [users, setUsers] = useState([]);
    const [depts, setDepts] = useState([]);
    const [stats, setStats] = useState({
        total: 0, admins: 0, faculty: 0, hods: 0, active: 0, inactive: 0
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [confirmPassword, setConfirmPassword] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        faculty_id: '',
        role: 'faculty',
        department_id: '',
        designation: '',
        phone: '',
        status: 'Active'
    });

    const fetchAllData = useCallback(async () => {
        try {
            const [usersRes, statsRes, deptsRes] = await Promise.all([
                API.get('/users_list'),
                API.get('/user-stats'),
                API.get('/departments')
            ]);
            setUsers(usersRes.data || []);
            setStats(statsRes.data || {});
            setDepts(deptsRes.data || []);
        } catch (err) {
            console.error("User Directory Data Fetch Error:", err);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleFormSubmit = async (e) => {
        if (e) e.preventDefault();

        if (!isEditing && formData.password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        try {
            if (isEditing) {
                await API.put(`/users/${selectedUser.id}`, formData);
                alert('User profile synchronized successfully.');
            } else {
                await API.post('/users', formData);
                alert('New user registered in enterprise system.');
            }
            setShowModal(false);
            fetchAllData();
            setFormData({
                name: '', email: '', password: '', faculty_id: '',
                role: 'faculty', department_id: '', designation: '',
                phone: '', status: 'Active'
            });
            setConfirmPassword('');
        } catch (err) {
            alert(err.response?.data?.detail || "Operation failed");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Mark this user as deleted? They will be retained for audit logs but removed from active registry.')) {
            try {
                await API.delete(`/users/${id}`);
                fetchAllData();
            } catch (err) {
                alert("Failed to deactivate user.");
            }
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             u.faculty_id?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = !filterRole || u.role === filterRole;
        const matchesDept = !filterDept || u.department_id === parseInt(filterDept);
        const matchesStatus = !filterStatus || u.status === filterStatus;
        return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });

    const getRoleBadge = (role) => {
        const styles = {
            super_admin: 'bg-rose-100 text-rose-700 border-rose-200',
            admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
            hod: 'bg-violet-100 text-violet-700 border-violet-200',
            faculty: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            staff: 'bg-blue-100 text-blue-700 border-blue-200',
            student: 'bg-slate-100 text-slate-700 border-slate-200'
        };
        return styles[role] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-8 lg:p-12">
            <header className="mb-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-1">Institutional ERP Module</p>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tightest uppercase italic">User Directory</h1>
                </div>
                <button
                    onClick={() => { setIsEditing(false); setShowModal(true); }}
                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                >
                    <Plus className="w-4 h-4" /> Register New Account
                </button>
            </header>

            {/* Statistics Section */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-12">
                {[
                    { label: 'Total Users', val: stats.total, color: 'indigo', icon: Users },
                    { label: 'Admins', val: stats.admins, color: 'rose', icon: ShieldCheck },
                    { label: 'Faculty', val: stats.faculty, color: 'emerald', icon: GraduationCap },
                    { label: 'HODs', val: stats.hods, color: 'violet', icon: Briefcase },
                    { label: 'Active', val: stats.active, color: 'blue', icon: UserCheck },
                    { label: 'Inactive', val: stats.inactive, color: 'slate', icon: UserX }
                ].map((s, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center group hover:border-indigo-100 transition-colors">
                        <div className={`w-10 h-10 rounded-xl bg-slate-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                            <s.icon className="w-5 h-5" />
                        </div>
                        <p className={`text-2xl font-black text-slate-900`}>{s.val}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
                {/* Search & Filter Hub */}
                <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                    <div className="flex flex-col lg:flex-row gap-4 items-center">
                        <div className="relative flex-1 group w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by name, username or email..."
                                className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-inner"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-4 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                            <select className="px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none focus:border-indigo-500" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                                <option value="">Role Filter</option>
                                <option value="super_admin">Super Admin</option>
                                <option value="admin">Admin</option>
                                <option value="hod">HOD</option>
                                <option value="faculty">Faculty</option>
                                <option value="staff">Staff</option>
                            </select>
                            <select className="px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none focus:border-indigo-500" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                                <option value="">Department</option>
                                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <select className="px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none focus:border-indigo-500" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                <option value="">Status</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                            <button onClick={() => { setSearchTerm(''); setFilterRole(''); setFilterDept(''); setFilterStatus(''); }} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"><X className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>

                {/* Table Hub */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                                <th className="p-8">Identity</th>
                                <th className="p-8">Department</th>
                                <th className="p-8">Designation</th>
                                <th className="p-8">Role</th>
                                <th className="p-8">Status</th>
                                <th className="p-8">Last Login</th>
                                <th className="p-8 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-8">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-700 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-100 ring-4 ring-white">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{user.name}</p>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <span className="text-[10px] font-bold text-slate-400">@{user.faculty_id}</span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                                    <span className="text-[10px] font-bold text-slate-400">{user.email}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-8">
                                        <p className="text-[11px] font-black text-slate-700 uppercase">{depts.find(d => d.id === user.department_id)?.name || 'N/A'}</p>
                                    </td>
                                    <td className="p-8">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{user.designation || 'ACADEMIC STAFF'}</p>
                                    </td>
                                    <td className="p-8">
                                        <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getRoleBadge(user.role)}`}>
                                            {user.role?.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="p-8">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${user.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                            <span className={`text-[10px] font-black uppercase ${user.status === 'Active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                {user.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-8">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Clock className="w-3 h-3" />
                                            <span className="text-[10px] font-bold uppercase">{user.last_login ? new Date(user.last_login).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'NEVER'}</span>
                                        </div>
                                    </td>
                                    <td className="p-8">
                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setSelectedUser(user); setFormData({...user, password: ''}); setIsEditing(true); setShowModal(true); }} className="p-3 bg-white border border-slate-100 rounded-xl text-indigo-500 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(user.id)} className="p-3 bg-white border border-slate-100 rounded-xl text-rose-500 hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="p-20 text-center flex flex-col items-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                <Search className="w-8 h-8" />
                            </div>
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No institutional identities matched your query.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Comprehensive Registry Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]">
                        <div className="bg-slate-900 p-10 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-widest italic">Identity Registry Hub</h3>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] mt-1">Enterprise User Management System v4.0</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"><X className="w-6 h-6" /></button>
                        </div>

                        <form className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1" onSubmit={handleFormSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Basic Identification */}
                                <div className="space-y-6">
                                    <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest border-b border-slate-100 pb-3">Primary Identification</h4>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Full Name</label>
                                        <input className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xs outline-none border-2 border-transparent focus:border-indigo-500 transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Dr. John Doe"/>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Employee ID / Username</label>
                                            <input className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.faculty_id} onChange={e => setFormData({...formData, faculty_id: e.target.value})} required placeholder="e.g. FAC001"/>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Phone Number</label>
                                            <input className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="e.g. 9876543210"/>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Email Address</label>
                                        <input type="email" className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required placeholder="email@kahe.edu"/>
                                    </div>
                                </div>

                                {/* Academic & Role Mapping */}
                                <div className="space-y-6">
                                    <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest border-b border-slate-100 pb-3">Organizational Mapping</h4>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Enterprise Role</label>
                                            <select className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                                                <option value="super_admin">Super Admin</option>
                                                <option value="admin">Admin</option>
                                                <option value="hod">HOD</option>
                                                <option value="faculty">Faculty</option>
                                                <option value="staff">Staff</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Current Status</label>
                                            <select className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                                <option value="Active">Active</option>
                                                <option value="Inactive">Inactive</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Department Registry</label>
                                        <select className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})}>
                                            <option value="">Select Department...</option>
                                            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Professional Designation</label>
                                        <input className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} placeholder="e.g. Assistant Professor"/>
                                    </div>
                                </div>
                            </div>

                            {/* Authentication Layer */}
                            <div className="space-y-6">
                                <h4 className="text-[11px] font-black text-rose-600 uppercase tracking-widest border-b border-slate-100 pb-3">Authentication Security Layer</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{isEditing ? 'New Password (Optional)' : 'Security Password'}</label>
                                        <input type="password" title={isEditing ? 'Leave blank to keep existing' : ''} className="w-full p-5 bg-indigo-50/50 rounded-2xl font-black text-xs outline-none border-2 border-transparent focus:border-rose-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!isEditing}/>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Confirm Security Credential</label>
                                        <input type="password" className="w-full p-5 bg-indigo-50/50 rounded-2xl font-black text-xs outline-none border-2 border-transparent focus:border-rose-500" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required={!isEditing}/>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-8">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-5 border-2 border-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all hover:bg-slate-50">Discard Entry</button>
                                <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all">Synchronize registry</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDirectory;
