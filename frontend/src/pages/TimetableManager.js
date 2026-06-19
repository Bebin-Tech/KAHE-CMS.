import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Edit3,
    Plus,
    RefreshCw,
    Save,
    Search,
    Trash2,
    X
} from 'lucide-react';
import API from '../api';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const statusOptions = ['Active', 'Inactive'];
const roomStatusOptions = ['AVAILABLE', 'IN_USE', 'MAINTENANCE'];
const roomTypes = ['Classroom', 'Lab', 'Seminar Hall', 'Office'];
const semesterNames = ['Semester I', 'Semester II', 'Semester III', 'Semester IV', 'Semester V', 'Semester VI'];

const emptyByModule = {
    departments: { code: '', name: '', classification: '', semester: '', status: 'Active' },
    programs: { code: '', name: '', department_id: '', duration: 3, status: 'Active', type: 'UG', regulation: '' },
    semesters: { name: 'Semester I', number: 1, academic_year: '', odd_even: 'Odd', status: 'Active', program_id: '', is_active: true },
    sections: { program_id: '', semester_id: '', name: '', student_strength: 60, status: 'Active' },
    subjects: { code: '', name: '', credits: 3, weekly_hours: 3, type: 'Theory', status: 'Active' },
    faculty: { faculty_id: '', name: '', department_id: '', designation: '', email: '', phone: '', status: 'Active', password: '' },
    mappings: { faculty_id: '', subject_id: '', section_id: '', section: '', semester_id: '' },
    curricula: { department_id: '', program_id: '', semester_id: '', subject_id: '', weekly_hours: 3, status: 'Active' },
    rooms: { room_number: '', type: 'Classroom', capacity: 60, building: '', floor: '', status: 'AVAILABLE', department: '' },
    settings: { working_days: days, total_periods_per_day: 6, lab_continuous: true, academic_year: '', active_semester_id: '' }
};

const moduleOrder = [
    'departments', 'programs', 'semesters', 'sections', 'subjects',
    'faculty', 'mappings', 'curricula', 'rooms', 'settings'
];

const endpointFor = {
    departments: '/departments',
    programs: '/programs',
    semesters: '/semesters',
    sections: '/sections',
    subjects: '/subjects',
    faculty: '/users',
    mappings: '/faculty-assignments',
    curricula: '/curricula',
    rooms: '/rooms',
    settings: '/settings/timetable'
};

const pageSize = 8;

const moduleFromPath = pathname => {
    if (pathname.includes('/programs')) return 'programs';
    if (pathname.includes('/semesters')) return 'semesters';
    if (pathname.includes('/sections')) return 'sections';
    if (pathname.includes('/subjects')) return 'subjects';
    if (pathname.includes('/faculty/directory')) return 'faculty';
    if (pathname.includes('/faculty/mapping')) return 'mappings';
    if (pathname.includes('/curriculum')) return 'curricula';
    if (pathname.includes('/spatial/infrastructure')) return 'rooms';
    if (pathname.includes('/settings')) return 'settings';
    if (pathname.includes('/academic/departments')) return 'departments';
    return 'departments';
};

function statusBadge(value) {
    const isSuccess = ['Active', 'AVAILABLE', 'APPROVED', 'PUBLISHED'].includes(value);
    const isWarning = ['IN_USE', 'PENDING', 'DRAFT'].includes(value);

    return (
        <span className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border ${
            isSuccess ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
            isWarning ? 'bg-amber-50 text-amber-700 border-amber-100' :
            'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
            {value || 'Active'}
        </span>
    );
}

const TimetableManager = () => {
    const location = useLocation();
    const [active, setActive] = useState(() => moduleFromPath(location.pathname));
    const [datasets, setDatasets] = useState({
        departments: [], programs: [], semesters: [], sections: [], subjects: [],
        faculty: [], mappings: [], curricula: [], settings: null, timetables: [], rooms: []
    });
    const [readiness, setReadiness] = useState({ is_ready: false, checks: [], errors: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyByModule.departments);
    const [searches, setSearches] = useState({});
    const [pages, setPages] = useState({});
    const [message, setMessage] = useState('');

    const fetchAll = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const results = await Promise.allSettled([
                API.get('/departments'), API.get('/programs'), API.get('/semesters'),
                API.get('/sections'), API.get('/subjects'), API.get('/users_list'),
                API.get('/faculty-assignments'), API.get('/curricula'),
                API.get('/settings/timetable'), API.get('/timetable/readiness'),
                API.get('/timetables'), API.get('/rooms')
            ]);

            const data = results.map(r => r.status === 'fulfilled' ? r.value.data : []);

            setDatasets({
                departments: data[0] || [],
                programs: data[1] || [],
                semesters: data[2] || [],
                sections: data[3] || [],
                subjects: data[4] || [],
                faculty: (data[5] || []).filter(u => u.role === 'faculty'),
                mappings: data[6] || [],
                curricula: data[7] || [],
                settings: results[8].status === 'fulfilled' ? results[8].value.data : null,
                timetables: data[10] || [],
                rooms: data[11] || []
            });

            if (results[9].status === 'fulfilled') {
                setReadiness(results[9].value.data);
            }
        } catch (error) {
            console.error("Institutional Data Sync Failure:", error);
            setMessage('Network error detected. Check backend connection.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        const newActive = moduleFromPath(location.pathname);
        setActive(newActive);
        setForm(emptyByModule[newActive] || emptyByModule.departments);
        setShowForm(false);
        setEditing(null);
    }, [location.pathname]);

    const lookups = useMemo(() => ({
        department: id => datasets.departments.find(item => item.id === Number(id))?.name || '-',
        program: id => datasets.programs.find(item => item.id === Number(id))?.name || '-',
        semester: id => {
            const sem = datasets.semesters.find(item => item.id === Number(id));
            if (!sem) return '-';
            const prog = datasets.programs.find(p => p.id === sem.program_id)?.name || '';
            return `${sem.name || `Sem ${sem.number}`} ${prog ? `(${prog})` : ''}`;
        },
        section: id => datasets.sections.find(item => item.id === Number(id))?.name || '-',
        faculty: id => datasets.faculty.find(item => item.id === Number(id))?.name || '-',
        subject: id => datasets.subjects.find(item => item.id === Number(id))?.name || '-'
    }), [datasets]);

    const modules = useMemo(() => ({
        departments: {
            title: 'Department Management',
            subtitle: 'Register institutional departments',
            columns: [['code', 'Code'], ['name', 'Name'], ['classification', 'Classification'], ['semester', 'Semester'], ['status', 'Status']],
            fields: [
                { key: 'code', label: 'Unique Code', required: true },
                { key: 'name', label: 'Department Name', required: true },
                { key: 'classification', label: 'Classification', required: true },
                { key: 'semester', label: 'Semester', type: 'select', options: semesterNames },
                { key: 'status', label: 'Status', type: 'select', options: statusOptions }
            ]
        },
        programs: {
            title: 'Program Management',
            subtitle: 'Academic programs registry',
            columns: [['code', 'Code'], ['name', 'Program'], ['department_id', 'Department'], ['duration', 'Duration (Y)'], ['status', 'Status']],
            fields: [
                { key: 'code', label: 'Program Code', required: true },
                { key: 'name', label: 'Program Name', required: true },
                { key: 'department_id', label: 'Department', type: 'select', options: datasets.departments.map(d => [d.id, d.name]), required: true },
                { key: 'duration', label: 'Duration (Years)', type: 'number', required: true },
                { key: 'status', label: 'Status', type: 'select', options: statusOptions }
            ],
            display: { department_id: lookups.department }
        },
        semesters: {
            title: 'Semester Management',
            subtitle: 'Define academic semesters',
            columns: [['name', 'Semester'], ['program_id', 'Program'], ['academic_year', 'Year'], ['odd_even', 'Cycle'], ['status', 'Status']],
            fields: [
                { key: 'name', label: 'Semester Name', type: 'select', options: semesterNames, required: true },
                { key: 'program_id', label: 'Program', type: 'select', options: datasets.programs.map(p => [p.id, p.name]), required: true },
                { key: 'academic_year', label: 'Academic Year', required: true, placeholder: 'e.g. 2023-2024' },
                { key: 'odd_even', label: 'Odd / Even', type: 'select', options: ['Odd', 'Even'], required: true },
                { key: 'status', label: 'Status', type: 'select', options: statusOptions }
            ],
            display: { program_id: lookups.program }
        },
        sections: {
            title: 'Section Management',
            subtitle: 'Manage class sections',
            columns: [['name', 'Section'], ['program_id', 'Program'], ['semester_id', 'Semester'], ['student_strength', 'Strength'], ['status', 'Status']],
            fields: [
                { key: 'name', label: 'Section Name', required: true, placeholder: 'e.g. A' },
                { key: 'program_id', label: 'Program', type: 'select', options: datasets.programs.map(p => [p.id, p.name]), required: true },
                { key: 'semester_id', label: 'Semester', type: 'select', options: datasets.semesters.map(s => [s.id, lookups.semester(s.id)]), required: true },
                { key: 'student_strength', label: 'Strength', type: 'number', required: true },
                { key: 'status', label: 'Status', type: 'select', options: statusOptions }
            ],
            display: { program_id: lookups.program, semester_id: lookups.semester }
        },
        subjects: {
            title: 'Subject Management',
            subtitle: 'Course curriculum registry',
            columns: [['code', 'Code'], ['name', 'Subject'], ['type', 'Type'], ['credits', 'Credits'], ['weekly_hours', 'Hrs/Wk'], ['status', 'Status']],
            fields: [
                { key: 'code', label: 'Subject Code', required: true },
                { key: 'name', label: 'Subject Name', required: true },
                { key: 'type', label: 'Type', type: 'select', options: ['Theory', 'Lab'] },
                { key: 'credits', label: 'Credits', type: 'number', required: true },
                { key: 'weekly_hours', label: 'Weekly Hours', type: 'number', required: true },
                { key: 'status', label: 'Status', type: 'select', options: statusOptions }
            ]
        },
        faculty: {
            title: 'Faculty Directory',
            subtitle: 'Institutional academic experts',
            columns: [['faculty_id', 'ID'], ['name', 'Name'], ['department_id', 'Dept'], ['designation', 'Rank'], ['status', 'Status']],
            fields: [
                { key: 'faculty_id', label: 'Employee ID', required: true },
                { key: 'name', label: 'Full Name', required: true },
                { key: 'email', label: 'Email Address', type: 'email', required: true },
                { key: 'department_id', label: 'Department', type: 'select', options: datasets.departments.map(d => [d.id, d.name]), required: true },
                { key: 'designation', label: 'Designation', required: true },
                { key: 'phone', label: 'Phone Number' },
                { key: 'password', label: 'Password', type: 'password', requiredOnCreate: true },
                { key: 'status', label: 'Status', type: 'select', options: statusOptions }
            ],
            display: { department_id: lookups.department }
        },
        mappings: {
            title: 'Faculty Mapping',
            subtitle: 'Assign faculty to courses',
            columns: [['faculty_id', 'Faculty'], ['subject_id', 'Subject'], ['section_id', 'Class']],
            fields: [
                { key: 'faculty_id', label: 'Faculty Expert', type: 'select', options: datasets.faculty.map(f => [f.id, f.name]), required: true },
                { key: 'subject_id', label: 'Subject', type: 'select', options: datasets.subjects.map(s => [s.id, s.name]), required: true },
                { key: 'section_id', label: 'Target Class', type: 'select', options: datasets.sections.map(s => [s.id, `${lookups.semester(s.semester_id)} - Sec ${s.name}`]), required: true }
            ],
            display: { faculty_id: lookups.faculty, subject_id: lookups.subject, section_id: lookups.section }
        },
        curricula: {
            title: 'Curriculum Hours',
            subtitle: 'Configure subject workloads',
            columns: [['semester_id', 'Semester'], ['subject_id', 'Subject'], ['weekly_hours', 'Hrs/Wk'], ['status', 'Status']],
            fields: [
                { key: 'semester_id', label: 'Semester', type: 'select', options: datasets.semesters.map(s => [s.id, lookups.semester(s.id)]), required: true },
                { key: 'subject_id', label: 'Subject', type: 'select', options: datasets.subjects.map(s => [s.id, s.name]), required: true },
                { key: 'weekly_hours', label: 'Weekly Hours', type: 'number', required: true },
                { key: 'status', label: 'Status', type: 'select', options: statusOptions }
            ],
            display: { semester_id: lookups.semester, subject_id: lookups.subject }
        },
        rooms: {
            title: 'Infrastructure Management',
            subtitle: 'Manage classrooms and laboratories',
            columns: [['room_number', 'Room No'], ['type', 'Type'], ['capacity', 'Seats'], ['building', 'Building'], ['status', 'Status']],
            fields: [
                { key: 'room_number', label: 'Room Number', required: true },
                { key: 'type', label: 'Room Type', type: 'select', options: roomTypes, required: true },
                { key: 'capacity', label: 'Capacity (Seats)', type: 'number', required: true },
                { key: 'building', label: 'Building Name' },
                { key: 'floor', label: 'Floor' },
                { key: 'status', label: 'Operational Status', type: 'select', options: roomStatusOptions }
            ]
        },
        settings: {
            title: 'Global Settings',
            subtitle: 'Timetable engine parameters',
            columns: [['academic_year', 'Academic Year'], ['working_days', 'Working Days'], ['total_periods_per_day', 'Periods/Day']],
            fields: [
                { key: 'academic_year', label: 'Active Academic Year', required: true },
                { key: 'working_days', label: 'Working Days', type: 'checks', options: days },
                { key: 'total_periods_per_day', label: 'Periods Per Day', type: 'number', required: true },
                { key: 'lab_continuous', label: 'Lab Continuity', type: 'select', options: [[true, 'Continuous'], [false, 'Single Period']] }
            ],
            display: { working_days: v => (v || []).join(', ') }
        }
    }), [datasets, lookups]);

    const renderValue = (row, key) => {
        const display = config.display?.[key];
        const value = row[key];
        if (key === 'status') return statusBadge(value);
        return display ? display(value, row) : (value ?? '-');
    };

    const config = modules[active] || modules.departments;
    const rows = active === 'settings' ? (datasets.settings ? [datasets.settings] : []) : datasets[active] || [];
    const query = (searches[active] || '').toLowerCase();
    const filteredRows = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query));

    const currentPage = pages[active] || 1;
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyByModule[active] || emptyByModule.departments);
        setShowForm(true);
    };

    const openEdit = row => {
        setEditing(row);
        setForm({ ...emptyByModule[active], ...row, password: '' });
        setShowForm(true);
    };

    const cancelForm = () => {
        setShowForm(false);
        setEditing(null);
        setMessage('');
    };

    const normalizePayload = () => {
        const p = { ...form };
        // Convert IDs to Numbers, but filter out empty strings to prevent Pydantic errors
        const idKeys = ['department_id', 'program_id', 'semester_id', 'subject_id', 'faculty_id', 'section_id', 'active_semester_id'];
        idKeys.forEach(k => {
            if (p[k] === '' || p[k] === null || p[k] === undefined) {
                delete p[k];
            } else {
                p[k] = Number(p[k]);
            }
        });

        const numKeys = ['duration', 'student_strength', 'credits', 'weekly_hours', 'total_periods_per_day', 'capacity'];
        numKeys.forEach(k => {
            if (p[k] !== undefined) p[k] = Number(p[k]);
        });

        if (active === 'faculty') {
            p.role = 'faculty';
            if (editing && !p.password) delete p.password;
        }

        if (active === 'mappings') {
            const sec = datasets.sections.find(s => s.id === Number(p.section_id));
            p.section = sec?.name || '';
            p.semester_id = sec?.semester_id || null;
        }

        return p;
    };

    const handleSave = async e => {
        if (e) e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            const payload = normalizePayload();
            const endpoint = endpointFor[active];

            if (active === 'settings') {
                await API.post(endpoint, payload);
            } else if (editing) {
                await API.put(`${endpoint}/${editing.id}`, payload);
            } else {
                await API.post(endpoint, payload);
            }

            setMessage('Record synchronized successfully.');
            setTimeout(() => {
                cancelForm();
                fetchAll(true);
            }, 500);
        } catch (err) {
            console.error("Save error:", err);
            const detail = err.response?.data?.detail;
            let msg = 'Institutional registry rejected the entry.';

            if (typeof detail === 'string') {
                msg = detail;
            } else if (Array.isArray(detail)) {
                msg = detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(' | ');
            }

            setMessage(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async row => {
        if (!window.confirm('Archive this record? It will be hidden from active modules.')) return;
        try {
            await API.delete(`${endpointFor[active]}/${row.id}`);
            fetchAll(true);
        } catch (err) {
            setMessage('Deactivation failed. Record may have institutional dependencies.');
        }
    };

    const runScheduler = async () => {
        setGenerating(true);
        setMessage('');
        try {
            await API.post('/generate-timetable');
            setMessage('Automated scheduling engine triggered. Refreshing matrix...');
            fetchAll(true);
        } catch (err) {
            setMessage(err.response?.data?.detail || 'Schedule generation failed due to constraint violations.');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 font-black text-indigo-500 uppercase tracking-[0.3em] animate-pulse">
            Institutional Kernel Booting...
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            <header className="mb-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-1">Academic Registry</p>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tightest uppercase italic">Institutional Input Modules</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => fetchAll()} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 transition-all shadow-sm">
                        <RefreshCw size={18} />
                    </button>
                    <button
                        onClick={runScheduler}
                        disabled={!readiness.is_ready || generating}
                        className={`px-8 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                            readiness.is_ready ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        {generating ? 'Engine Running...' : 'Auto Scheduler'}
                    </button>
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

            {/* Internal Tabs */}
            <div className="mb-8 flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                {moduleOrder.map(m => (
                    <button
                        key={m}
                        onClick={() => {
                            const paths = {
                                rooms: '/timetable/spatial/infrastructure',
                                departments: '/timetable/academic/departments',
                                faculty: '/timetable/faculty/directory',
                                mappings: '/timetable/faculty/mapping'
                            };
                            window.history.pushState({}, '', paths[m] || `/timetable/academic/${m}`);
                            setActive(m);
                        }}
                        className={`whitespace-nowrap px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.15em] transition-all border ${
                            active === m ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200 hover:text-indigo-600'
                        }`}
                    >
                        {m.toUpperCase()}
                    </button>
                ))}
            </div>

            {/* Main Table Card */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50/30">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">{config.title}</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{config.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all shadow-inner"
                                placeholder="Search registry..."
                                value={searches[active] || ''}
                                onChange={e => {
                                    setSearches({...searches, [active]: e.target.value});
                                    setPages({...pages, [active]: 1});
                                }}
                            />
                        </div>
                        <button onClick={openCreate} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">
                            + Register entry
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                {config.columns.map(c => <th key={c[0]} className="p-8">{c[1]}</th>)}
                                <th className="p-8 text-right">Operations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {pagedRows.map((row, i) => (
                                <tr key={row.id || i} className="hover:bg-slate-50/50 transition-colors group">
                                    {config.columns.map(c => (
                                        <td key={c[0]} className="p-8 text-sm font-bold text-slate-600">
                                            {c[0] === 'status' ? statusBadge(row[c[0]]) : renderValue(row, c[0])}
                                        </td>
                                    ))}
                                    <td className="p-8">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEdit(row)} className="p-2.5 bg-white border border-slate-100 rounded-lg text-indigo-500 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Edit3 size={14} /></button>
                                            {active !== 'settings' && <button onClick={() => handleDelete(row)} className="p-2.5 bg-white border border-slate-100 rounded-lg text-rose-400 hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 size={14} /></button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {pagedRows.length === 0 && (
                                <tr><td colSpan={config.columns.length + 1} className="p-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">No institutional records found in this module.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-8 border-t border-slate-50 flex justify-between items-center bg-slate-50/20">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Registry page {currentPage} of {totalPages}</span>
                    <div className="flex gap-2">
                        <button disabled={currentPage === 1} onClick={() => setPages({...pages, [active]: currentPage - 1})} className="px-4 py-2 bg-white border border-slate-100 rounded-lg text-[10px] font-black text-slate-600 disabled:opacity-40 transition-all">Prev</button>
                        <button disabled={currentPage === totalPages} onClick={() => setPages({...pages, [active]: currentPage + 1})} className="px-4 py-2 bg-white border border-slate-100 rounded-lg text-[10px] font-black text-slate-600 disabled:opacity-40 transition-all">Next</button>
                    </div>
                </div>
            </div>

            {/* Entry Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-widest italic">{editing ? 'Edit' : 'Register'} Institutional Entry</h3>
                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.3em] mt-1">{config.title}</p>
                            </div>
                            <button onClick={cancelForm} className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/40 hover:text-white transition-all"><X size={20} /></button>
                        </div>

                        <form className="p-10 space-y-8 overflow-y-auto custom-scrollbar" onSubmit={handleSave}>
                            {message && (
                                <div className={`p-4 rounded-xl flex items-center gap-3 border ${message.includes('Sync') ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                                    <AlertCircle size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">{message}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {config.fields.map(f => {
                                    const value = form[f.key] ?? (f.type === 'checks' ? [] : '');
                                    const apply = val => setForm({...form, [f.key]: val});

                                    return (
                                        <div key={f.key} className={f.type === 'checks' ? 'md:col-span-2' : ''}>
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">{f.label}</label>
                                            {f.type === 'select' ? (
                                                <select className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl font-bold text-xs outline-none transition-all" value={String(value)} onChange={e => apply(e.target.value)} required={f.required}>
                                                    <option value="">Select Option...</option>
                                                    {f.options.map(opt => {
                                                        const [v, l] = Array.isArray(opt) ? opt : [opt, opt];
                                                        return <option key={String(v)} value={String(v)}>{l}</option>;
                                                    })}
                                                </select>
                                            ) : f.type === 'checks' ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                                    {f.options.map(o => (
                                                        <label key={o} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <input type="checkbox" checked={value.includes(o)} onChange={e => apply(e.target.checked ? [...value, o] : value.filter(x => x !== o))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                            <span className="text-[10px] font-black text-slate-600 uppercase">{o.slice(0,3)}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : (
                                                <input
                                                    type={f.type || 'text'}
                                                    className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl font-bold text-xs outline-none transition-all"
                                                    value={value}
                                                    onChange={e => apply(e.target.value)}
                                                    required={f.required || (!editing && f.requiredOnCreate)}
                                                    placeholder={f.placeholder}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex gap-4 pt-6 shrink-0">
                                <button type="button" onClick={cancelForm} className="flex-1 py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all">Discard</button>
                                <button type="submit" disabled={saving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all">
                                    {saving ? 'Syncing...' : 'Save Registry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimetableManager;
