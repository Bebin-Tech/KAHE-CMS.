import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    CheckCircle2,
    Edit3,
    Trash2,
    RefreshCw,
    Plus,
    X,
    Save,
    Search,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import API from '../api';

const TimetableManager = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // --- MODULE CONFIGURATION ---
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const semesterNames = ['Semester I', 'Semester II', 'Semester III', 'Semester IV', 'Semester V', 'Semester VI'];

    const moduleFromPath = useCallback((pathname) => {
        if (pathname.includes('/programs')) return 'PROGRAMS';
        if (pathname.includes('/semesters')) return 'SEMESTERS';
        if (pathname.includes('/sections')) return 'SECTIONS';
        if (pathname.includes('/subjects')) return 'SUBJECTS';
        if (pathname.includes('/faculty/directory')) return 'FACULTY';
        if (pathname.includes('/faculty/mapping')) return 'MAPPINGS';
        if (pathname.includes('/curriculum')) return 'CURRICULUM';
        if (pathname.includes('/spatial/infrastructure')) return 'ROOMS';
        if (pathname.includes('/settings')) return 'SETTINGS';
        return 'DEPARTMENTS';
    }, []);

    // --- CORE STATE ---
    const [activeModule, setActiveModule] = useState(() => moduleFromPath(location.pathname));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' }); // type: 'success' | 'error'
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);

    // --- DATA REGISTRY ---
    const [datasets, setDatasets] = useState({
        departments: [], programs: [], semesters: [], sections: [], subjects: [],
        faculty: [], mappings: [], curricula: [], rooms: [], settings: null
    });
    const [readiness, setReadiness] = useState({ is_ready: false, checks: [] });

    // --- UI STATE ---
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 8;
    const [formData, setFormData] = useState({});

    // Sync state with URL changes
    useEffect(() => {
        const newModule = moduleFromPath(location.pathname);
        if (newModule !== activeModule) {
            setActiveModule(newModule);
            setCurrentPage(1);
            setSearchTerm('');
            setShowModal(false);
            setEditingRecord(null);
            setMessage({ text: '', type: '' });
        }
    }, [location.pathname, activeModule, moduleFromPath]);

    // --- LOOKUPS ---
    const lookups = useMemo(() => ({
        department: id => datasets.departments.find(i => i.id === Number(id))?.name || '-',
        program: id => datasets.programs.find(i => i.id === Number(id))?.name || '-',
        semester: id => {
            const sem = datasets.semesters.find(i => i.id === Number(id));
            if (!sem) return '-';
            const prog = datasets.programs.find(p => p.id === sem.program_id)?.name || '';
            return `Sem ${sem.number} ${prog ? `(${prog})` : ''}`;
        },
        section: id => datasets.sections.find(i => i.id === Number(id))?.name || '-',
        faculty: id => datasets.faculty.find(i => i.id === Number(id))?.name || '-',
        subject: id => datasets.subjects.find(i => i.id === Number(id))?.name || '-'
    }), [datasets]);

    const moduleConfigs = useMemo(() => ({
        DEPARTMENTS: {
            title: 'Department Registry',
            endpoint: '/departments',
            columns: [['code', 'Code'], ['name', 'Name'], ['classification', 'Classification'], ['semester', 'Semester'], ['status', 'Status']],
            fields: [
                { key: 'code', label: 'Unique Code', required: true },
                { key: 'name', label: 'Department Name', required: true },
                { key: 'classification', label: 'Classification', required: true, placeholder: 'e.g. Theory' },
                { key: 'semester', label: 'Semester', required: true, type: 'select', options: semesterNames },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ]
        },
        PROGRAMS: {
            title: 'Program Management',
            endpoint: '/programs',
            columns: [['code', 'Code'], ['name', 'Name'], ['department_id', 'Department'], ['duration', 'Years'], ['status', 'Status']],
            fields: [
                { key: 'code', label: 'Program Code', required: true },
                { key: 'name', label: 'Program Name', required: true },
                { key: 'department_id', label: 'Department', type: 'select', options: datasets.departments.map(d => [d.id, d.name]), required: true },
                { key: 'duration', label: 'Duration (Years)', type: 'number', required: true },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ],
            display: { department_id: lookups.department }
        },
        SEMESTERS: {
            title: 'Semester Setup',
            endpoint: '/semesters',
            columns: [['number', 'No'], ['program_id', 'Program'], ['academic_year', 'Year'], ['odd_even', 'Cycle'], ['status', 'Status']],
            fields: [
                { key: 'number', label: 'Semester Number', type: 'number', required: true },
                { key: 'program_id', label: 'Program', type: 'select', options: datasets.programs.map(p => [p.id, p.name]), required: true },
                { key: 'academic_year', label: 'Academic Year', required: true, placeholder: 'e.g. 2023-2024' },
                { key: 'odd_even', label: 'Cycle Type', type: 'select', options: ['Odd', 'Even'], required: true },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ],
            display: { program_id: lookups.program }
        },
        SECTIONS: {
            title: 'Section Registry',
            endpoint: '/sections',
            columns: [['name', 'Section'], ['semester_id', 'Semester'], ['student_strength', 'Strength'], ['status', 'Status']],
            fields: [
                { key: 'name', label: 'Section Name', required: true, placeholder: 'e.g. A' },
                { key: 'semester_id', label: 'Semester', type: 'select', options: datasets.semesters.map(s => [s.id, lookups.semester(s.id)]), required: true },
                { key: 'student_strength', label: 'Student Strength', type: 'number', required: true },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ],
            display: { semester_id: lookups.semester }
        },
        SUBJECTS: {
            title: 'Subject Curriculum',
            endpoint: '/subjects',
            columns: [['code', 'Code'], ['name', 'Subject'], ['type', 'Type'], ['weekly_hours', 'Hrs/Wk'], ['status', 'Status']],
            fields: [
                { key: 'code', label: 'Subject Code', required: true },
                { key: 'name', label: 'Subject Name', required: true },
                { key: 'type', label: 'Type', type: 'select', options: ['Theory', 'Lab'], required: true },
                { key: 'credits', label: 'Credits', type: 'number', required: true },
                { key: 'weekly_hours', label: 'Weekly Hours', type: 'number', required: true },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ]
        },
        FACULTY: {
            title: 'Faculty Expert Directory',
            endpoint: '/users',
            columns: [['faculty_id', 'ID'], ['name', 'Name'], ['department_id', 'Dept'], ['designation', 'Rank'], ['status', 'Status']],
            fields: [
                { key: 'faculty_id', label: 'Employee ID', required: true },
                { key: 'name', label: 'Full Name', required: true },
                { key: 'email', label: 'Institutional Email', type: 'email', required: true },
                { key: 'department_id', label: 'Department', type: 'select', options: datasets.departments.map(d => [d.id, d.name]), required: true },
                { key: 'designation', label: 'Designation', required: true },
                { key: 'phone', label: 'Contact Number' },
                { key: 'password', label: 'Security Password', type: 'password', requiredOnCreate: true },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ],
            display: { department_id: lookups.department }
        },
        MAPPINGS: {
            title: 'Resource Allocation',
            endpoint: '/faculty-assignments',
            columns: [['faculty_id', 'Faculty'], ['subject_id', 'Subject'], ['section', 'Section']],
            fields: [
                { key: 'faculty_id', label: 'Faculty Expert', type: 'select', options: datasets.faculty.map(f => [f.id, f.name]), required: true },
                { key: 'subject_id', label: 'Target Subject', type: 'select', options: datasets.subjects.map(s => [s.id, s.name]), required: true },
                { key: 'section', label: 'Academic Section', required: true, placeholder: 'e.g. A' }
            ],
            display: { faculty_id: lookups.faculty, subject_id: lookups.subject }
        },
        CURRICULUM: {
            title: 'Workload Parameters',
            endpoint: '/curricula',
            columns: [['semester_id', 'Semester'], ['subject_id', 'Subject'], ['weekly_hours', 'Hrs/Wk'], ['status', 'Status']],
            fields: [
                { key: 'semester_id', label: 'Semester', type: 'select', options: datasets.semesters.map(s => [s.id, lookups.semester(s.id)]), required: true },
                { key: 'subject_id', label: 'Subject', type: 'select', options: datasets.subjects.map(s => [s.id, s.name]), required: true },
                { key: 'weekly_hours', label: 'Weekly Hours', type: 'number', required: true },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ],
            display: { semester_id: lookups.semester, subject_id: lookups.subject }
        },
        ROOMS: {
            title: 'Institutional Spaces',
            endpoint: '/rooms',
            columns: [['room_number', 'Room'], ['type', 'Type'], ['capacity', 'Seats'], ['status', 'Status']],
            fields: [
                { key: 'room_number', label: 'Room Index', required: true },
                { key: 'type', label: 'Facility Type', type: 'select', options: ['Classroom', 'Lab', 'Office'], required: true },
                { key: 'capacity', label: 'Occupancy Limit', type: 'number', required: true },
                { key: 'building', label: 'Building/Block' },
                { key: 'floor', label: 'Floor Level' },
                { key: 'status', label: 'Operational Status', type: 'select', options: ['AVAILABLE', 'MAINTENANCE'] }
            ]
        },
        SETTINGS: {
            title: 'Engine Settings',
            endpoint: '/settings/timetable',
            columns: [['academic_year', 'Year'], ['total_periods_per_day', 'Periods/Day'], ['lab_continuous', 'Lab Flow']],
            fields: [
                { key: 'academic_year', label: 'Active Year', required: true },
                { key: 'total_periods_per_day', label: 'Periods Per Day', type: 'number', required: true },
                { key: 'lab_continuous', label: 'Lab Flow', type: 'select', options: [[true, 'Continuous'], [false, 'Single']] },
                { key: 'working_days', label: 'Operational Days', type: 'checks', options: days }
            ]
        }
    }), [datasets, lookups, days, semesterNames]);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const results = await Promise.allSettled([
                API.get('/departments'), API.get('/programs'), API.get('/semesters'),
                API.get('/sections'), API.get('/subjects'), API.get('/users_list'),
                API.get('/faculty-assignments'), API.get('/curricula'),
                API.get('/rooms'), API.get('/settings/timetable'), API.get('/timetable/readiness')
            ]);

            const d = results.map(r => r.status === 'fulfilled' ? r.value.data : []);

            setDatasets({
                departments: d[0] || [], programs: d[1] || [], semesters: d[2] || [],
                sections: d[3] || [], subjects: d[4] || [],
                faculty: Array.isArray(d[5]) ? d[5].filter(u => u.role === 'faculty') : [],
                mappings: d[6] || [], curricula: d[7] || [], rooms: d[8] || [],
                settings: results[9].status === 'fulfilled' ? results[9].value.data : null
            });

            if (results[10].status === 'fulfilled') setReadiness(results[10].value.data);
        } catch (err) {
            console.error("Institutional Gateway Sync failure.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const currentConfig = moduleConfigs[activeModule] || moduleConfigs.DEPARTMENTS;
    const moduleKey = activeModule.toLowerCase();
    const rows = activeModule === 'SETTINGS' ? (datasets.settings ? [datasets.settings] : []) : (datasets[moduleKey] || []);
    const filteredRows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(searchTerm.toLowerCase()));
    const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
    const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        setMessage({ text: '', type: '' });
        try {
            const p = { ...formData };
            // Conversion logic
            Object.keys(p).forEach(k => {
                if (k.endsWith('_id') || ['duration', 'number', 'student_strength', 'credits', 'weekly_hours', 'capacity', 'total_periods_per_day'].includes(k)) {
                    if (p[k] !== undefined && p[k] !== '') p[k] = Number(p[k]);
                }
                if (k === 'lab_continuous') p[k] = p[k] === 'true' || p[k] === true;
            });

            if (activeModule === 'FACULTY') p.role = 'faculty';

            const endpoint = currentConfig.endpoint;
            if (editingRecord) await API.put(`${endpoint}/${editingRecord.id}`, p);
            else await API.post(endpoint, p);

            setMessage({ text: 'Registry synchronized successfully.', type: 'success' });
            setTimeout(() => {
                setShowModal(false);
                setEditingRecord(null);
                setFormData({});
                fetchData(true);
            }, 800);
        } catch (err) {
            console.error("Save failure:", err);
            const detail = err.response?.data?.detail;
            let errorMsg = 'Institutional Registry rejected the entry.';
            if (typeof detail === 'string') errorMsg = detail;
            else if (Array.isArray(detail)) errorMsg = detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(' | ');
            setMessage({ text: errorMsg, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row) => {
        if (!window.confirm('Archive this record? This action will hide it from active modules.')) return;
        try {
            await API.delete(`${currentConfig.endpoint}/${row.id}`);
            fetchData(true);
        } catch (err) {
            alert('Operation blocked: Record has institutional dependencies.');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 font-black text-indigo-500 uppercase tracking-[0.3em] animate-pulse">
            Institutional Kernel Booting...
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-1">Academic Registry</p>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tightest uppercase italic">Institutional Input Modules</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => fetchData()} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm"><RefreshCw size={18}/></button>
                </div>
            </header>

            {/* Readiness Summary */}
            <div className={`mb-8 p-6 rounded-[2rem] border-2 transition-all ${
                readiness.is_ready ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'
            }`}>
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-2.5 h-2.5 rounded-full ${readiness.is_ready ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-700">Institutional Readiness: {readiness.is_ready ? 'READY' : 'INCOMPLETE'}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(readiness.checks || []).map((c, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white/60 p-3 rounded-xl border border-slate-100">
                            {c.passed ? <CheckCircle2 className="text-emerald-500" size={14} /> : <AlertCircle className="text-rose-500" size={14} />}
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{c.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* MODULE NAVIGATION (Auto-synced with URL) */}
            <div className="mb-10 flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                {Object.keys(moduleConfigs).map(m => (
                    <button
                        key={m}
                        onClick={() => {
                            const paths = {
                                DEPARTMENTS: '/timetable/academic/departments',
                                PROGRAMS: '/timetable/academic/programs',
                                SEMESTERS: '/timetable/academic/semesters',
                                SECTIONS: '/timetable/academic/sections',
                                SUBJECTS: '/timetable/academic/subjects',
                                FACULTY: '/timetable/faculty/directory',
                                MAPPINGS: '/timetable/faculty/mapping',
                                CURRICULUM: '/timetable/academic/curriculum',
                                ROOMS: '/timetable/spatial/infrastructure',
                                SETTINGS: '/timetable/settings'
                            };
                            if (paths[m]) navigate(paths[m]);
                        }}
                        className={`whitespace-nowrap px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border ${
                            activeModule === m ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200 hover:text-indigo-600'
                        }`}
                    >
                        {m}
                    </button>
                ))}
            </div>

            {/* DATA TABLE SECTION */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/30">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">{currentConfig.title}</h2>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Active records in registry</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <input className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 shadow-inner" placeholder="Search records..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}/>
                        </div>
                        {activeModule !== 'SETTINGS' && (
                            <button onClick={() => { setEditingRecord(null); setFormData({}); setShowModal(true); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">+ Register entry</button>
                        )}
                        {activeModule === 'SETTINGS' && datasets.settings && (
                            <button onClick={() => { setEditingRecord(datasets.settings); setFormData(datasets.settings); setShowModal(true); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">Configure Engine</button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                {currentConfig.columns.map(c => <th key={c[0]} className="p-8">{c[1]}</th>)}
                                <th className="p-8 text-right">Operation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {pagedRows.map((row, i) => (
                                <tr key={row.id || i} className="hover:bg-slate-50/50 transition-colors group">
                                    {currentConfig.columns.map(c => {
                                        const key = c[0];
                                        const value = row[key];
                                        const display = currentConfig.display?.[key];
                                        let finalValue = display ? display(value, row) : (value ?? '-');

                                        if (key === 'status') {
                                            const isS = ['Active', 'AVAILABLE'].includes(value);
                                            finalValue = <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isS ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{value || 'Active'}</span>;
                                        }

                                        return <td key={key} className="p-8 text-sm font-bold text-slate-600">{finalValue}</td>;
                                    })}
                                    <td className="p-8 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingRecord(row); setFormData(row); setShowModal(true); }} className="p-2 bg-white border border-slate-100 rounded-lg text-indigo-500 shadow-sm"><Edit3 size={14} /></button>
                                            {activeModule !== 'SETTINGS' && <button onClick={() => handleDelete(row)} className="p-2 bg-white border border-slate-100 rounded-lg text-rose-400 shadow-sm"><Trash2 size={14} /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pagedRows.length === 0 && (
                                <tr><td colSpan={currentConfig.columns.length + 1} className="p-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">No institutional records found in this module.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-8 border-t border-slate-50 flex justify-between items-center bg-slate-50/20">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Registry page {currentPage} / {totalPages}</span>
                    <div className="flex gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 bg-white border border-slate-100 rounded-lg disabled:opacity-30"><ChevronLeft size={16}/></button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 bg-white border border-slate-100 rounded-lg disabled:opacity-30"><ChevronRight size={16}/></button>
                    </div>
                </div>
            </div>

            {/* MODAL SYSTEM */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-widest italic">{editingRecord ? 'Modify' : 'Initialize'} Institutional Entry</h3>
                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.3em] mt-1">{currentConfig.title}</p>
                            </div>
                            <button onClick={() => { setShowModal(false); setMessage({text:'', type:''}); }} className="text-white/40 hover:text-white transition-all"><X size={20} /></button>
                        </div>
                        <form className="p-10 space-y-6 overflow-y-auto custom-scrollbar" onSubmit={handleSave}>
                            {message.text && (
                                <div className={`p-4 rounded-xl text-[10px] font-black uppercase border ${
                                    message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
                                }`}>
                                    {message.text}
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {currentConfig.fields.map(f => (
                                    <div key={f.key} className={f.type === 'checks' ? 'md:col-span-2' : ''}>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">{f.label}</label>
                                        {f.type === 'select' ? (
                                            <select className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" value={String(formData[f.key] || '')} onChange={e => setFormData({...formData, [f.key]: e.target.value})} required={f.required}>
                                                <option value="">Select Option...</option>
                                                {f.options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={String(v)} value={String(v)}>{l}</option>; })}
                                            </select>
                                        ) : f.type === 'checks' ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {f.options.map(o => (
                                                    <label key={o} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer border border-transparent hover:border-indigo-100">
                                                        <input type="checkbox" checked={(formData[f.key] || []).includes(o)} onChange={e => setFormData({...formData, [f.key]: e.target.checked ? [...(formData[f.key] || []), o] : (formData[f.key] || []).filter(x => x !== o)})} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                        <span className="text-[10px] font-black text-slate-600 uppercase">{o}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : <input type={f.type || 'text'} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" value={formData[f.key] || ''} onChange={e => setFormData({...formData, [f.key]: e.target.value})} required={f.required} placeholder={f.placeholder} />}
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-4 pt-6 shrink-0">
                                <button type="button" onClick={() => { setShowModal(false); setMessage({text:'', type:''}); }} className="flex-1 py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all hover:bg-slate-50">Discard</button>
                                <button type="submit" disabled={saving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all">{saving ? 'Syncing...' : 'Save Registry'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimetableManager;
