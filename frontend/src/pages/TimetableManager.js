import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
    AlertCircle,
    CheckCircle2,
    Edit3,
    Trash2,
    RefreshCw,
    X,
    Search,
    ChevronLeft,
    ChevronRight,
    Lock,
    UserCheck,
    UserX,
    Calendar,
    LayoutDashboard,
    Zap,
    Download
} from 'lucide-react';
import API from '../api';

const DAYS_LIST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SEMESTER_NAMES = ['Semester I', 'Semester II', 'Semester III', 'Semester IV', 'Semester V', 'Semester VI', 'Semester VII', 'Semester VIII'];

const TimetableManager = () => {
    const location = useLocation();

    const moduleFromPath = useCallback((pathname) => {
        const p = pathname.toLowerCase();
        if (p.includes('/programs')) return 'PROGRAMS';
        if (p.includes('/semesters')) return 'SEMESTERS';
        if (p.includes('/sections')) return 'SECTIONS';
        if (p.includes('/subjects')) return 'SUBJECTS';
        if (p.includes('/users')) return 'USER_MGMT';
        if (p.includes('/faculty/mapping')) return 'MAPPINGS';
        if (p.includes('/curriculum')) return 'CURRICULUM';
        if (p.includes('/infrastructure')) return 'ROOMS';
        if (p.includes('/classroom/tracking')) return 'CLASSROOM_TRACKER';
        if (p.includes('/settings')) return 'SETTINGS';
        if (p.includes('/reports/faculty')) return 'REPORTS_WORKLOAD';
        if (p.includes('/reports/classroom')) return 'REPORTS_CLASSROOM';
        if (p.includes('/reports/utilization')) return 'REPORTS_LAB';
        if (p.includes('/reports/department')) return 'REPORTS_DEPARTMENT';
        if (p.includes('/audit/')) return 'AUDIT';
        if (p.includes('/dashboard')) return 'TIMETABLE_DASHBOARD';
        if (p.includes('/matrix')) return 'TIMETABLE_MATRIX';
        return 'DEPARTMENTS';
    }, []);

    const [activeModule, setActiveModule] = useState(() => moduleFromPath(location.pathname));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);

    const [datasets, setDatasets] = useState({
        departments: [], programs: [], semesters: [], sections: [], subjects: [],
        faculty: [], mappings: [], curricula: [], rooms: [], settings: null,
        users: [], audit: [], reports_workload: [], reports_classroom: [],
        reports_lab: [], reports_department: [], timetables: [],
        working_days: [], periods: []
    });
    const [readiness, setReadiness] = useState({ is_ready: false, checks: [] });
    const [dashboardStats, setDashboardStats] = useState({});
    const [selectedSemester, setSelectedSemester] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 8;
    const [formData, setFormData] = useState({});

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

    const lookups = useMemo(() => ({
        department: id => (datasets.departments || []).find(i => i.id === Number(id))?.name || '-',
        program: id => (datasets.programs || []).find(i => i.id === Number(id))?.name || '-',
        semester: id => {
            const sem = (datasets.semesters || []).find(i => i.id === Number(id));
            if (!sem) return '-';
            const prog = (datasets.programs || []).find(p => p.id === sem.program_id)?.name || '';
            return `Sem ${sem.number} ${prog ? `(${prog})` : ''}`;
        },
        section: id => (datasets.sections || []).find(i => i.id === Number(id))?.name || '-',
        faculty: id => (datasets.users || []).find(i => i.id === Number(id))?.full_name || '-',
        subject: id => (datasets.subjects || []).find(i => i.id === Number(id))?.name || '-'
    }), [datasets.departments, datasets.programs, datasets.semesters, datasets.sections, datasets.users, datasets.subjects]);

    const moduleConfigs = useMemo(() => ({
        DEPARTMENTS: {
            title: 'Department Registry', endpoint: '/departments',
            columns: [['code', 'Code'], ['name', 'Name'], ['classification', 'Classification'], ['status', 'Status']],
            fields: [
                { key: 'code', label: 'Unique Code', required: true },
                { key: 'name', label: 'Department Name', required: true },
                { key: 'classification', label: 'Classification', required: true },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ]
        },
        PROGRAMS: {
            title: 'Program Management', endpoint: '/programs',
            columns: [['code', 'Code'], ['name', 'Name'], ['department_id', 'Department'], ['duration_years', 'Years'], ['status', 'Status']],
            fields: [
                { key: 'code', label: 'Program Code', required: true },
                { key: 'name', label: 'Program Name', required: true },
                { key: 'department', label: 'Department', type: 'select', options: (datasets.departments || []).map(d => [d.id, d.name]), required: true },
                { key: 'duration_years', label: 'Duration (Years)', type: 'number', required: true },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ],
            display: { department_id: lookups.department }
        },
        SEMESTERS: {
            title: 'Semester Setup', endpoint: '/semesters',
            columns: [['number', 'No'], ['program_id', 'Program'], ['is_active', 'Active']],
            fields: [
                { key: 'number', label: 'Semester Number', type: 'number', required: true },
                { key: 'program', label: 'Program', type: 'select', options: (datasets.programs || []).map(p => [p.id, p.name]), required: true },
                { key: 'is_active', label: 'Is Active', type: 'select', options: [[true, 'Yes'], [false, 'No']] }
            ],
            display: { program_id: lookups.program }
        },
        SECTIONS: {
            title: 'Section Registry', endpoint: '/sections',
            columns: [['name', 'Section'], ['semester_id', 'Semester'], ['student_count', 'Strength'], ['status', 'Status']],
            fields: [
                { key: 'name', label: 'Section Name', required: true, placeholder: 'e.g. A' },
                { key: 'semester', label: 'Semester', type: 'select', options: (datasets.semesters || []).map(s => [s.id, lookups.semester(s.id)]), required: true },
                { key: 'student_count', label: 'Student Strength', type: 'number', required: true },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ],
            display: { semester_id: lookups.semester }
        },
        SUBJECTS: {
            title: 'Subject Curriculum', endpoint: '/subjects',
            columns: [['code', 'Code'], ['name', 'Subject'], ['mne', 'MNE'], ['weekly_hours', 'Hrs/Wk'], ['status', 'Status']],
            fields: [
                { key: 'code', label: 'Subject Code', required: true },
                { key: 'name', label: 'Subject Name', required: true },
                { key: 'mne', label: 'MNE (Abbreviation)', placeholder: 'e.g. PYTH' },
                { key: 'type', label: 'Type', type: 'select', options: ['Theory', 'Lab'], required: true },
                { key: 'credits', label: 'Credits', type: 'number', required: true },
                { key: 'syllabus_hours', label: 'Periods (Syllabus)', type: 'number' },
                { key: 'allotted_hours', label: 'Periods (Allotted)', type: 'number' },
                { key: 'weekly_hours', label: 'Weekly Target Hours', type: 'number', required: true },
                { key: 'department', label: 'Department', type: 'select', options: (datasets.departments || []).map(d => [d.id, d.name]), required: true },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ]
        },
        USER_MGMT: {
            title: 'System User Registry', endpoint: '/users',
            columns: [['username', 'Username'], ['full_name', 'Name'], ['department_name', 'Dept'], ['role', 'Role'], ['status', 'Status']],
            fields: [
                { key: 'first_name', label: 'Full Name', required: true },
                { key: 'username', label: 'Username', required: true },
                { key: 'role', label: 'System Role', type: 'select', options: [['faculty', 'Faculty'], ['hod', 'HOD'], ['staff', 'Staff'], ['admin', 'Admin'], ['super_admin', 'Super Admin']], required: true },
                { key: 'department', label: 'Primary Department', type: 'select', options: (datasets.departments || []).map(d => [d.id, d.name]), required: true },
                { key: 'password', label: 'Secure Password', type: 'password', required: true },
                { key: 'confirm_password', label: 'Confirm Password', type: 'password', required: true },
                { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
            ],
            actions: [
                { label: 'Reset PWD', icon: Lock, color: 'text-amber-500', type: 'RESET_PWD' },
                { label: 'Toggle Status', icon: RefreshCw, color: 'text-blue-500', type: 'TOGGLE_STATUS' }
            ]
        },
        MAPPINGS: {
            title: 'Resource Allocation', endpoint: '/faculty-assignments',
            columns: [['faculty_id', 'Faculty'], ['subject_id', 'Subject'], ['section_id', 'Section']],
            fields: [
                { key: 'faculty', label: 'Faculty Expert', type: 'select', options: (datasets.users || []).filter(u => u.role === 'faculty').map(f => [f.id, f.full_name]), required: true },
                { key: 'subject', label: 'Target Subject', type: 'select', options: (datasets.subjects || []).map(s => [s.id, s.name]), required: true },
                { key: 'section', label: 'Academic Section', type: 'select', options: (datasets.sections || []).map(s => [s.id, lookups.section(s.id)]), required: true }
            ],
            display: { faculty_id: lookups.faculty, subject_id: lookups.subject, section_id: lookups.section }
        },
        CURRICULUM: {
            title: 'Workload Parameters', endpoint: '/curricula',
            columns: [['semester_id', 'Semester'], ['subject_id', 'Subject'], ['weekly_hours', 'Hrs/Wk']],
            fields: [
                { key: 'department', label: 'Department', type: 'select', options: (datasets.departments || []).map(d => [d.id, d.name]), required: true },
                { key: 'program', label: 'Program', type: 'select', options: (datasets.programs || []).map(p => [p.id, p.name]), required: true },
                { key: 'semester', label: 'Semester', type: 'select', options: (datasets.semesters || []).map(s => [s.id, lookups.semester(s.id)]), required: true },
                { key: 'subject', label: 'Subject', type: 'select', options: (datasets.subjects || []).map(s => [s.id, s.name]), required: true },
                { key: 'weekly_hours', label: 'Weekly Hours', type: 'number', required: true }
            ],
            display: { semester_id: lookups.semester, subject_id: lookups.subject }
        },
        ROOMS: {
            title: 'Institutional Spaces', endpoint: '/rooms',
            columns: [['room_number', 'Room'], ['type', 'Type'], ['capacity', 'Seats'], ['status', 'Status']],
            fields: [
                { key: 'room_number', label: 'Room Index', required: true },
                { key: 'type', label: 'Facility Type', type: 'select', options: ['Classroom', 'Lab', 'Seminar Hall'], required: true },
                { key: 'capacity', label: 'Occupancy Limit', type: 'number', required: true },
                { key: 'building', label: 'Building/Block' },
                { key: 'status', label: 'Operational Status', type: 'select', options: ['Available', 'Occupied'] }
            ]
        },
        CLASSROOM_TRACKER: {
            title: 'Live Institutional Tracking', endpoint: '/rooms',
            columns: [['room_number', 'Room'], ['type', 'Type'], ['capacity', 'Seats'], ['status', 'Status']],
            actions: [
                { label: 'Control Session', icon: Zap, color: 'text-amber-500', type: 'SESSION_CONTROL' }
            ]
        },
        SETTINGS: {
            title: 'Engine Settings', endpoint: '/settings/timetable',
            columns: [['academic_year', 'Year'], ['periods_per_day', 'Periods/Day'], ['lab_continuous', 'Lab Flow']],
            fields: [
                { key: 'academic_year', label: 'Active Year', required: true },
                { key: 'periods_per_day', label: 'Periods Per Day', type: 'number', required: true },
                { key: 'lab_continuous', label: 'Lab Flow', type: 'select', options: [[true, 'Continuous'], [false, 'Single']] },
                { key: 'working_days', label: 'Operational Days', type: 'checks', options: DAYS_LIST.slice(0, 5) }
            ],
            display: { working_days: v => (v || []).join(', ') }
        },
        REPORTS_WORKLOAD: {
            title: 'Faculty Workload Report',
            columns: [['name', 'Faculty'], ['department', 'Department'], ['actual_hours', 'Assigned Hrs'], ['target_hours', 'Target Hrs'], ['utilization', 'Utilization %']]
        },
        REPORTS_CLASSROOM: {
            title: 'Classroom Utilization Report',
            columns: [['room_number', 'Room'], ['type', 'Type'], ['occupied_slots', 'Occupied Slots'], ['utilization_percentage', 'Utilization %'], ['status', 'Status']]
        },
        REPORTS_LAB: {
            title: 'Lab Utilization Report',
            columns: [['room_number', 'Lab'], ['occupied_slots', 'Occupied Slots'], ['utilization_percentage', 'Utilization %'], ['status', 'Status']]
        },
        REPORTS_DEPARTMENT: {
            title: 'Department Summary Report',
            columns: [['name', 'Department'], ['programs_count', 'Programs'], ['subjects_count', 'Subjects'], ['faculties_count', 'Faculties'], ['schedules_count', 'Schedules']]
        },
        AUDIT: {
            title: 'System Audit Logs', endpoint: '/audit-logs',
            columns: [['timestamp', 'Time'], ['user_name', 'User'], ['action', 'Action'], ['resource', 'Resource'], ['details', 'Details']],
            display: { timestamp: v => new Date(v).toLocaleString() }
        }
    }), [datasets.departments, datasets.programs, datasets.semesters, datasets.sections, datasets.users, datasets.subjects, lookups]);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const results = await Promise.allSettled([
                API.get('/departments/'), API.get('/programs/'), API.get('/semesters/'),
                API.get('/sections/'), API.get('/subjects/'), API.get('/users_list/'),
                API.get('/faculty-assignments/'), API.get('/curricula/'),
                API.get('/rooms/'), API.get('/settings/timetable/'), API.get('/timetable/readiness/'),
                API.get('/dashboard-stats/'), API.get('/working-days/'), API.get('/period-timings/'),
                API.get('/faculty-workload/'), API.get('/classroom-availability/'),
                API.get('/reports/department-summary/'), API.get('/audit-logs/')
            ]);

            const d = results.map((r, i) => {
                if (r.status === 'rejected') {
                    console.error(`Institutional Registry Sync failure at index ${i}:`, r.reason);
                    return [];
                }
                return r.value.data;
            });

            setDatasets({
                departments: d[0] || [], programs: d[1] || [], semesters: d[2] || [],
                sections: d[3] || [], subjects: d[4] || [],
                users: d[5] || [],
                mappings: d[6] || [], curricula: d[7] || [], rooms: d[8] || [],
                settings: results[9].status === 'fulfilled' ? results[9].value.data : null,
                readiness: results[10].status === 'fulfilled' ? results[10].value.data : { is_ready: false, checks: [] },
                dashboard_stats: d[11] || {},
                working_days: d[12] || [],
                periods: d[13] || [],
                reports_workload: d[14] || [],
                reports_classroom: Array.isArray(d[15]) ? d[15].filter(r => r.type === 'Classroom') : [],
                reports_lab: Array.isArray(d[15]) ? d[15].filter(r => r.type === 'Lab') : [],
                reports_department: d[16] || [],
                audit: d[17] || []
            });

            if (results[10].status === 'fulfilled') setReadiness(results[10].value.data);
            if (results[11].status === 'fulfilled') setDashboardStats(results[11].value.data);
        } catch (err) {
            console.error("Institutional Gateway Sync failure.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

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
            } else if (type === 'SESSION_CONTROL') {
                if (row.status === 'Available') {
                    const fId = prompt("Enter Faculty User ID:");
                    const sId = prompt("Enter Subject ID:");
                    if (fId && sId) {
                        await API.post('/start-session/', { room_id: row.id, faculty_id: Number(fId), subject_id: Number(sId) });
                        alert('Session started successfully.');
                        fetchData(true);
                    }
                } else {
                    const history = await API.get('/class-history/');
                    const activeS = history.data.find(s => s.room_id === row.id && s.status === 'Active');
                    if (activeS) {
                        await API.post('/end-session/', { session_id: activeS.id });
                        alert('Session ended successfully.');
                        fetchData(true);
                    } else {
                        // Force free if no session found but status is Occupied
                        if(window.confirm('Room marked occupied but no active session found. Force available?')) {
                            await API.patch(`/rooms/${row.id}/`, { status: 'Available' });
                            fetchData(true);
                        }
                    }
                }
            }
        } catch (err) {
            alert('Operation failed: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();

        // Password validation for Faculty Management
        if (activeModule === 'FACULTY_MGMT') {
            if (formData.password !== formData.confirm_password) {
                setMessage({ text: 'Passwords do not match.', type: 'error' });
                return;
            }
        }

        setSaving(true);
        setMessage({ text: '', type: '' });
        try {
            // Create a clean copy of formData and trim all string values
            const p = {};
            Object.keys(formData).forEach(key => {
                const val = formData[key];
                p[key] = (typeof val === 'string') ? val.trim() : val;
            });

            // Password validation and cleanup for User Management
            if (activeModule === 'USER_MGMT') {
                if (p.password !== p.confirm_password) {
                    setMessage({ text: 'Passwords do not match.', type: 'error' });
                    setSaving(false);
                    return;
                }
                delete p.confirm_password;

                // Sanitization: Remove spaces from username for email/internal usage
                const cleanUsername = String(p.username || '').replace(/\s+/g, '').toLowerCase();

                // Ensure required Django User fields are present and valid
                if (!p.employee_id) p.employee_id = cleanUsername;
                if (!p.last_name) p.last_name = '-'; // Django User model likes this non-empty usually

                if (!p.email) {
                    // Use username as base, but ensure it's not already an email
                    if (cleanUsername.includes('@')) {
                        p.email = cleanUsername;
                    } else {
                        p.email = `${cleanUsername}@kahe.edu.in`;
                    }
                }

                // Force username to be the clean version to prevent login issues later
                p.username = cleanUsername;
            }

            // Ensure IDs and Numbers are correct types
            Object.keys(p).forEach(k => {
                if (['department', 'program', 'semester', 'subject', 'faculty', 'section', 'duration_years', 'number', 'student_count', 'credits', 'weekly_hours', 'capacity', 'periods_per_day'].includes(k)) {
                    if (p[k] !== undefined && p[k] !== '') p[k] = Number(p[k]);
                }
            });

            const endpoint = moduleConfigs[activeModule].endpoint;
            if (editingRecord) await API.put(`${endpoint}/${editingRecord.id}/`, p);
            else await API.post(`${endpoint}/`, p);

            setMessage({ text: 'Registry synchronized successfully.', type: 'success' });
            setTimeout(() => { setShowModal(false); setEditingRecord(null); setFormData({}); fetchData(true); }, 800);
        } catch (err) {
            let errorMsg = 'Registry rejection.';
            if (err.response?.data) {
                const data = err.response.data;
                if (typeof data === 'object') {
                    // Extract field-specific errors
                    const errors = Object.entries(data)
                        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
                        .join(' | ');
                    if (errors) errorMsg = errors;
                } else if (data.detail) {
                    errorMsg = data.detail;
                }
            }
            setMessage({ text: errorMsg, type: 'error' });
        } finally { setSaving(false); }
    };

    const handleGenerate = async (params = {}) => {
        try {
            const res = await API.post('/generate-timetable/', params);
            alert(res.data.message);
            fetchData(true);
        } catch (err) {
            alert(err.response?.data?.detail || "Generation failed");
        }
    };

    const handleBulkUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setSaving(true);
        try {
            const res = await API.post('/bulk-import-faculty/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(res.data.message);
            if (res.data.errors && res.data.errors.length > 0) {
                console.error("Bulk Import Errors:", res.data.errors);
                alert("Import completed with some errors. Check console for details.");
            }
            fetchData(true);
        } catch (err) {
            alert(err.response?.data?.detail || "Bulk import failed.");
        } finally {
            setSaving(false);
            e.target.value = null; // Clear input
        }
    };

    const handleDownloadReport = async (format) => {
        try {
            let path = '';
            if (activeModule === 'REPORTS_WORKLOAD') path = `/reports/${format}/faculty-workload`;
            else if (activeModule === 'REPORTS_CLASSROOM') path = `/reports/${format}/classroom-utilization`;
            else if (activeModule === 'REPORTS_LAB') path = `/reports/${format}/lab-utilization`;
            else if (activeModule === 'REPORTS_DEPARTMENT') path = `/reports/${format}/department-summary`;

            if (!path) return;
            const response = await API.get(path, { responseType: 'blob' });
            const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `${activeModule.toLowerCase()}_report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert("Export failed.");
        }
    };

    if (loading) return <div className="p-20 text-center animate-pulse font-black text-indigo-500 uppercase tracking-widest">Booting Institutional Kernel...</div>;

    // Special Rendering for Dashboard & Matrix
    if (activeModule === 'TIMETABLE_DASHBOARD') {
        return (
            <div className="min-h-screen bg-[#f8fafc] p-10">
                <header className="mb-12"><h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic">Timetable Dashboard</h1></header>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                        { label: 'Total Semesters', val: dashboardStats.total_semesters, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Active Conflicts', val: dashboardStats.conflict_alerts, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                        { label: 'Generated Slots', val: dashboardStats.generated_timetables, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
                        { label: 'Approved Maps', val: dashboardStats.approved_timetables, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' }
                    ].map(s => (
                        <div key={s.label} className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col items-center">
                            <div className={`p-5 rounded-3xl ${s.bg} ${s.color} mb-6`}><s.icon size={28}/></div>
                            <p className="text-5xl font-black text-slate-900">{s.val}</p>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">{s.label}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-12 bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-100">
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-8">Execute Intelligent Batch</h2>
                    <div className="flex gap-6">
                        <button onClick={() => handleGenerate()} className="flex-1 py-6 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all">Start Auto-Scheduler</button>
                    </div>
                </div>
            </div>
        );
    }

    if (activeModule === 'TIMETABLE_MATRIX') {
        const fetchTimetable = async (id) => {
            try {
                const res = await API.get(`/timetables/?section__semester_id=${id}`);
                setDatasets(prev => ({ ...prev, timetables: Array.isArray(res.data) ? res.data : [] }));
            } catch (err) {
                console.error("Failed to fetch timetable matrix:", err);
            }
        };
        return (
            <div className="min-h-screen bg-[#f8fafc] p-10">
                <header className="mb-10"><h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic">Institutional Master Matrix</h1></header>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex gap-4 mb-10 shadow-sm">
                    <select className="flex-1 p-4 bg-slate-50 border-none rounded-2xl font-bold outline-none" value={selectedSemester} onChange={e => { setSelectedSemester(e.target.value); fetchTimetable(e.target.value); }}>
                        <option value="">Choose Semester View...</option>
                        {(datasets.semesters || []).map(s => <option key={s.id} value={s.id}>{lookups.semester(s.id)}</option>)}
                    </select>
                </div>
                {selectedSemester && (
                    <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                                        <th className="p-8 text-left border-r border-white/10">Day \ Period</th>
                                        {(datasets.periods || []).map(p => <th key={p.id} className="p-8 border-r border-white/10 text-center">P{p.period_number}<br/><span className="text-[7px] opacity-40">{p.start_time}-{p.end_time}</span></th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(datasets.working_days || []).map(day => (
                                        <tr key={day.id}>
                                            <td className="p-8 bg-slate-50/50 font-black text-slate-900 text-xs uppercase border-r border-slate-100">{day.day_name}</td>
                                            {(datasets.periods || []).map(period => {
                                                const slot = (datasets.timetables || []).find(t => t.day === day.day_name && t.period === period.id);
                                                return (
                                                    <td key={period.id} className={`p-4 border-r border-slate-50 text-center min-w-[200px] ${period.is_break ? 'bg-amber-50/20' : ''}`}>
                                                        {period.is_break ? <span className="text-[9px] font-black text-amber-500 uppercase">{period.label}</span> : slot ? (
                                                            <div className="p-5 rounded-[2rem] bg-indigo-50 border border-indigo-100 text-indigo-700">
                                                                <p className="text-[11px] font-black leading-tight uppercase">{slot.subject?.mne || slot.subject?.name}</p>
                                                                <p className="text-[9px] font-bold mt-2 uppercase text-slate-400">{slot.faculty?.name}</p>
                                                                <p className="text-[9px] font-black mt-1 text-indigo-500">ROOM {slot.room?.room_number}</p>
                                                            </div>
                                                        ) : <span className="text-[9px] text-slate-200 font-bold uppercase">Vacant</span>}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const currentConfig = moduleConfigs[activeModule] || moduleConfigs.DEPARTMENTS;
    const moduleKeyMap = {
        USER_MGMT: 'users',
        CURRICULUM: 'curricula',
        CLASSROOM_TRACKER: 'rooms'
    };
    const moduleKey = moduleKeyMap[activeModule] || activeModule.toLowerCase();
    const rows = datasets[moduleKey] || [];
    const filteredRows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(searchTerm.toLowerCase()));
    const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
            {/* HEADER */}
            <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-1">Institutional ERP</p>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tightest uppercase italic">Input Modules</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => fetchData()} className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm"><RefreshCw size={18}/></button>
                </div>
            </header>

            {/* READINESS WIDGET */}
            <div className={`mb-10 p-8 rounded-[2.5rem] border-2 transition-all ${readiness.is_ready ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}>
                <div className="flex items-center gap-3 mb-6">
                    <div className={`w-3 h-3 rounded-full ${readiness.is_ready ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-700">Institutional Engine Readiness: {readiness.is_ready ? 'READY' : 'INCOMPLETE'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {(readiness.checks || []).map((c, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-white/60 rounded-2xl border border-slate-100">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{c.label}</span>
                            {c.passed ? <CheckCircle2 className="text-emerald-500" size={14} /> : <AlertCircle className="text-rose-500" size={14} />}
                        </div>
                    ))}
                </div>
            </div>

            {/* NAVIGATION TABS */}
            <div className="mb-10 flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                {Object.keys(moduleConfigs).map(m => (
                    <button
                        key={m}
                        onClick={() => { setActiveModule(m); setCurrentPage(1); setSearchTerm(''); }}
                        className={`whitespace-nowrap px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border ${
                            activeModule === m ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200 hover:text-indigo-600'
                        }`}
                    >
                        {m.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {/* DATA GRID */}
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
                        {activeModule.startsWith('REPORTS_') && (
                            <div className="flex gap-2">
                                <button onClick={() => handleDownloadReport('pdf')} className="px-4 py-3 bg-rose-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Export PDF</button>
                                <button onClick={() => handleDownloadReport('excel')} className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Export Excel</button>
                            </div>
                        )}
                        {activeModule === 'USER_MGMT' && (
                            <div className="flex gap-2">
                                <label className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest cursor-pointer hover:bg-slate-200 transition-all border border-slate-200 flex items-center gap-2 shadow-sm">
                                    <Download size={14} className="rotate-180" />
                                    Bulk Import
                                    <input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleBulkUpload} />
                                </label>
                            </div>
                        )}
                        {currentConfig.fields && currentConfig.fields.length > 0 && (
                            <button onClick={() => { setEditingRecord(null); setFormData({}); setShowModal(true); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">+ Register entry</button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                {currentConfig.columns.map(c => <th key={c[0]} className="p-8">{c[1]}</th>)}
                                <th className="p-8 text-right">Ops</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {pagedRows.map((row, i) => (
                                <tr key={row.id || i} className="hover:bg-slate-50/50 transition-colors group">
                                    {currentConfig.columns.map(c => {
                                        const key = c[0];
                                        const val = row[key];
                                        const display = currentConfig.display?.[key];
                                        let finalVal = display ? display(val, row) : (val ?? '-');

                                        if (key === 'status') {
                                            const isS = ['Active', 'Available'].includes(val) || row.is_active;
                                            finalVal = <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isS ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{val || (row.is_active ? 'Active' : 'Inactive')}</span>;
                                        }
                                        return <td key={key} className="p-8 text-sm font-bold text-slate-600">{finalVal}</td>;
                                    })}
                                    <td className="p-8 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {currentConfig.actions && currentConfig.actions.map(a => (
                                                <button key={a.label} onClick={() => handleAction(a.type, row)} className={`p-2 bg-white border border-slate-100 rounded-lg ${a.color} shadow-sm`} title={a.label}><a.icon size={14}/></button>
                                            ))}
                                            {currentConfig.fields && currentConfig.fields.length > 0 && (
                                                <>
                                                    <button onClick={() => { setEditingRecord(row); setFormData(row); setShowModal(true); }} className="p-2 bg-white border border-slate-100 rounded-lg text-indigo-500 shadow-sm"><Edit3 size={14} /></button>
                                                    <button onClick={async () => { if(window.confirm('Delete?')) { await API.delete(`${currentConfig.endpoint}/${row.id}/`); fetchData(true); } }} className="p-2 bg-white border border-slate-100 rounded-lg text-rose-400 shadow-sm"><Trash2 size={14} /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-8 border-t border-slate-50 flex justify-between items-center bg-slate-50/20">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Page {currentPage} / {totalPages}</span>
                    <div className="flex gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-2 bg-white border border-slate-100 rounded-lg disabled:opacity-30 transition-all hover:bg-slate-50"><ChevronLeft size={16}/></button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-2 bg-white border border-slate-100 rounded-lg disabled:opacity-30 transition-all hover:bg-slate-50"><ChevronRight size={16}/></button>
                    </div>
                </div>
            </div>

            {/* MODAL SYSTEM */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-black uppercase tracking-widest italic">{editingRecord ? 'Modify' : 'Initialize'} Institutional Entry</h3>
                            <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-all"><X size={20} /></button>
                        </div>
                        <form className="p-10 space-y-6 overflow-y-auto custom-scrollbar" onSubmit={handleSave}>
                            {message.text && <div className={`p-4 rounded-xl text-[10px] font-black uppercase ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{message.text}</div>}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {currentConfig.fields && currentConfig.fields.map(f => (
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
                                <button type="button" onClick={() => { setShowModal(false); }} className="flex-1 py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all">Discard</button>
                                <button type="submit" disabled={saving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:scale-[1.02] transition-all">{saving ? 'Syncing...' : 'Confirm Entry'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimetableManager;
