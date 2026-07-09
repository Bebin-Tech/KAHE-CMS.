import React, { useState } from 'react';
import {
    Edit3,
    Trash2,
    X,
    Search,
    ChevronLeft,
    ChevronRight,
    Download
} from 'lucide-react';
import API from '../api';

const pageSize = 8;

const RegistryPage = ({ moduleKey, config, datasets, lookups, fetchData, saving, setSaving }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [formData, setFormData] = useState({});
    const [message, setMessage] = useState({ text: '', type: '' });

    const rows = config.rows || datasets[moduleKey] || [];
    const filteredRows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(searchTerm.toLowerCase()));
    const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;

    const handleAction = async (type, row) => {
        try {
            if (type === 'RESET_PWD') {
                const newPwd = prompt(`Enter new password for ${row.full_name}:`, 'faculty123');
                if (newPwd) {
                    await API.post(`/users/${row.id}/reset_password/`, { password: newPwd });
                    alert('Password reset successful.');
                }
            } else if (type === 'TOGGLE_STATUS') {
                if (row.is_active) await API.post(`/users/${row.id}/deactivate/`);
                else await API.post(`/users/${row.id}/activate/`);
                fetchData(true);
            }
        } catch (err) {
            alert('Operation failed.');
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();

        // Validation for User Management
        if (moduleKey === 'users') {
            if (formData.password && formData.password !== formData.confirm_password) {
                setMessage({ text: 'Passwords do not match.', type: 'error' });
                return;
            }
        }

        setSaving(true);
        setMessage({ text: '', type: '' });
        try {
            const p = {};
            Object.assign(p, config.defaultValues || {});
            Object.keys(formData).forEach(key => {
                const val = formData[key];
                p[key] = (typeof val === 'string') ? val.trim() : val;
            });

            if (moduleKey === 'users') {
                delete p.confirm_password;
                const cleanUsername = String(p.username || '').replace(/\s+/g, '').toLowerCase();
                if (!p.employee_id) p.employee_id = cleanUsername;
                if (!p.last_name) p.last_name = '-';
                if (!p.email) p.email = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@kahe.edu.in`;
                p.username = cleanUsername;
            }

            // Ensure IDs and Numbers are correct types
            Object.keys(p).forEach(k => {
                if (['department', 'program', 'semester', 'subject', 'faculty', 'section', 'duration_years', 'number', 'student_count', 'credits', 'weekly_hours', 'capacity', 'periods_per_day'].includes(k)) {
                    if (p[k] !== undefined && p[k] !== '') p[k] = Number(p[k]);
                }
            });

            const endpoint = config.endpoint;
            if (editingRecord) await API.put(`${endpoint}${editingRecord.id}/`, p);
            else await API.post(`${endpoint}`, p);

            setMessage({ text: 'Registry synchronized successfully.', type: 'success' });
            setTimeout(() => { setShowModal(false); setEditingRecord(null); setFormData({}); fetchData(true); }, 800);
        } catch (err) {
            let errorMsg = 'Registry rejection.';
            if (err.response?.data) {
                const data = err.response.data;
                if (typeof data === 'object') {
                    const errors = Object.entries(data).map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`).join(' | ');
                    if (errors) errorMsg = errors;
                } else if (data.detail) errorMsg = data.detail;
            }
            setMessage({ text: errorMsg, type: 'error' });
        } finally { setSaving(false); }
    };

    const handleBulkUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const upData = new FormData();
        upData.append('file', file);
        setSaving(true);
        try {
            const res = await API.post('/bulk-import-faculty/', upData, { headers: { 'Content-Type': 'multipart/form-data' } });
            alert(res.data.message);
            fetchData(true);
        } catch (err) { alert(err.response?.data?.detail || "Bulk import failed."); }
        finally { setSaving(false); e.target.value = null; }
    };

    return (
        <div className="space-y-10">
            <div className="bg-white rounded-[2rem] shadow-md border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-100/60">
                <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">{config.title}</h2>
                    <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-widest">Active records in registry</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={16} />
                        <input className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-indigo-500 shadow-sm" placeholder="Search records..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}/>
                    </div>
                    {moduleKey === 'users' && config.allowBulkImport !== false && (
                        <label className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest cursor-pointer hover:bg-slate-200 transition-all border border-slate-200 flex items-center gap-2 shadow-sm">
                            <Download size={14} className="rotate-180" />
                            Bulk Import
                            <input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleBulkUpload} />
                        </label>
                    )}
                    {config.fields && config.fields.length > 0 && (
                        <button onClick={() => { setEditingRecord(null); setFormData(config.defaultValues || {}); setShowModal(true); setMessage({text:'', type:''}); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">{config.createLabel || '+ Register entry'}</button>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-100 text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] border-b border-slate-200">
                            {config.columns.map(c => <th key={c[0]} className="p-8">{c[1]}</th>)}
                            <th className="p-8 text-right">Ops</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {pagedRows.map((row, i) => (
                            <tr key={row.id || i} className="hover:bg-indigo-50/40 transition-colors group">
                                {config.columns.map(c => {
                                    const key = c[0];
                                    const val = row[key];
                                    const display = config.display?.[key];
                                    let finalVal = display ? display(val, row) : (val ?? '-');
                                    if (key === 'status') {
                                        const isS = ['Active', 'Available'].includes(val) || row.is_active;
                                        finalVal = <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${isS ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-700 border-slate-300'}`}>{val || (row.is_active ? 'Active' : 'Inactive')}</span>;
                                    }
                                    return <td key={key} className="p-8 text-sm font-bold text-slate-800">{finalVal}</td>;
                                })}
                                <td className="p-8 text-right">
                                    <div className="flex justify-end gap-2 opacity-100 transition-opacity">
                                        {config.actions && config.actions.map(a => (
                                            <button key={a.label} onClick={() => handleAction(a.type, row)} className={`p-2 bg-white border border-slate-300 rounded-lg ${a.color} shadow-sm hover:bg-slate-50`} title={a.label}><a.icon size={14}/></button>
                                        ))}
                                        {config.fields && config.fields.length > 0 && (
                                            <>
                                                <button onClick={() => { setEditingRecord(row); setFormData(row); setShowModal(true); setMessage({text:'', type:''}); }} className="p-2 bg-white border border-slate-300 rounded-lg text-indigo-600 shadow-sm hover:bg-indigo-50"><Edit3 size={14} /></button>
                                                <button onClick={async () => { if(window.confirm('Delete?')) { await API.delete(`${config.endpoint}${row.id}/`); fetchData(true); } }} className="p-2 bg-white border border-slate-300 rounded-lg text-rose-600 shadow-sm hover:bg-rose-50"><Trash2 size={14} /></button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="p-8 border-t border-slate-200 flex justify-between items-center bg-slate-100/60">
                <span className="text-[10px] font-black text-slate-700 uppercase">Page {currentPage} / {totalPages}</span>
                <div className="flex gap-2">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 bg-white border border-slate-300 rounded-lg disabled:opacity-40 transition-all hover:bg-slate-50 text-slate-700"><ChevronLeft size={16}/></button>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 bg-white border border-slate-300 rounded-lg disabled:opacity-40 transition-all hover:bg-slate-50 text-slate-700"><ChevronRight size={16}/></button>
                </div>
            </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-black uppercase tracking-widest italic">{editingRecord ? 'Modify' : 'Initialize'} Institutional Entry</h3>
                            <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-all"><X size={20} /></button>
                        </div>
                        <form className="p-10 space-y-6 overflow-y-auto custom-scrollbar" onSubmit={handleSave}>
                            {message.text && <div className={`p-4 rounded-xl text-[10px] font-black uppercase ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{message.text}</div>}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {config.fields && config.fields.map(f => (
                                    <div key={f.key} className={f.type === 'checks' ? 'md:col-span-2' : ''}>
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 mb-2 block">{f.label}</label>
                                        {f.type === 'select' ? (
                                                <select className="w-full p-4 bg-white border border-slate-300 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" value={String(formData[f.key] || '')} onChange={e => setFormData({...formData, [f.key]: e.target.value})} required={f.required}>
                                                <option value="">Select Option...</option>
                                                {f.options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={String(v)} value={String(v)}>{l}</option>; })}
                                            </select>
                                        ) : f.type === 'checks' ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {f.options.map(o => (
                                                    <label key={o} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer border border-slate-200 hover:border-indigo-300">
                                                        <input type="checkbox" checked={(formData[f.key] || []).includes(o)} onChange={e => setFormData({...formData, [f.key]: e.target.checked ? [...(formData[f.key] || []), o] : (formData[f.key] || []).filter(x => x !== o)})} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                        <span className="text-[10px] font-black text-slate-600 uppercase">{o}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : <input type={f.type || 'text'} className="w-full p-4 bg-white border border-slate-300 rounded-2xl font-bold text-xs text-slate-800 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" value={formData[f.key] || ''} onChange={e => setFormData({...formData, [f.key]: e.target.value})} required={editingRecord && ['password', 'confirm_password'].includes(f.key) ? false : f.required} placeholder={f.placeholder} />}
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-4 pt-6 shrink-0">
                                <button type="button" onClick={() => { setShowModal(false); }} className="flex-1 py-4 border-2 border-slate-300 text-slate-700 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all">Discard</button>
                                <button type="submit" disabled={saving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:scale-[1.02] transition-all">{saving ? 'Syncing...' : 'Confirm Entry'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegistryPage;
