import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import API from '../api';
import { Clock } from 'lucide-react';

const TimetableManager = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // --- ENTERPRISE CORE STATE ---
    const [activeTab, setActiveTab] = useState('STATS');
    const [activeSubTab, setActiveSubTab] = useState('GENERAL');

    // Sync State with URL
    useEffect(() => {
        const path = location.pathname;
        if (path.includes('/dashboard')) {
            setActiveTab('STATS');
        } else if (path.includes('/matrix')) {
            setActiveTab('MATRIX');
        } else if (path.includes('/academic/')) {
            setActiveTab('ACADEMIC');
            if (path.includes('/departments')) setActiveSubTab('DEPT');
            if (path.includes('/programs')) setActiveSubTab('PROG');
            if (path.includes('/semesters')) setActiveSubTab('SEM');
            if (path.includes('/sections')) setActiveSubTab('SEC');
            if (path.includes('/subjects')) setActiveSubTab('SUBJECT');
        } else if (path.includes('/faculty/')) {
            setActiveTab('FACULTY');
            if (path.includes('/directory')) setActiveSubTab('DIRECTORY');
            if (path.includes('/mapping')) setActiveSubTab('MAPPING');
            if (path.includes('/availability')) setActiveSubTab('AVAILABILITY');
        } else if (path.includes('/spatial/')) {
            setActiveTab('SPATIAL');
            if (path.includes('/infrastructure')) setActiveSubTab('INFRASTRUCTURE');
            if (path.includes('/occupancy')) setActiveSubTab('OCCUPANCY');
        } else if (path.includes('/settings')) {
            setActiveTab('SETTINGS');
        } else {
            // Default or redirect
            if (path === '/timetable' || path === '/timetable/') {
                navigate('/timetable/dashboard');
            }
        }
    }, [location.pathname, navigate]);

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Data Registry
    const [subjects, setSubjects] = useState([]);
    const [faculties, setFaculties] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [depts, setDepts] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [sections, setSections] = useState([]);
    const [timetables, setTimetables] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [stats, setStats] = useState({});

    // Analytics
    const [facAvailability, setFacAvailability] = useState([]);
    const [roomAvailability, setRoomAvailability] = useState([]);
    const [conflicts, setConflicts] = useState([]);

    // View Filters
    const [filterSem, setFilterSem] = useState('');
    const [filterFac, setFilterFac] = useState('');
    const [draggedSlot, setDraggedSlot] = useState(null);

    // Modal Control
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState(''); // DEPT, PROG, SEM, SEC, SUBJECT, FAC_MAP, ROOM, SETTINGS
    const [formData, setFormData] = useState({});

    // Classroom Session State
    const [showStartModal, setShowStartModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [activeSessions, setActiveSessions] = useState({});
    const [statusPopup, setStatusPopup] = useState({ show: false, message: '' });
    const [sessionData, setSessionData] = useState({
        faculty_name: '',
        faculty_id_display: '',
        department: '',
        subject: '',
        section: '',
        date: new Date().toISOString().split('T')[0],
        start_time_display: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        remarks: ''
    });

    const triggerPopup = (message) => {
        setStatusPopup({ show: true, message });
        setTimeout(() => setStatusPopup({ show: false, message: '' }), 3000);
    };

    const role = localStorage.getItem('role')?.toLowerCase();
    const currentUserId = parseInt(localStorage.getItem('user_id'));

    // --- INTEGRATED DATA ENGINE ---
    const fetchEverything = useCallback(async () => {
        try {
            const [sub, fac, rm, sem, sec, dept, prog, tt, pt, asgn, logs, sData, fAvail, rAvail, conf, activeSess] = await Promise.all([
                API.get('/subjects'), API.get('/users_list'), API.get('/rooms'),
                API.get('/semesters'), API.get('/sections'), API.get('/departments'),
                API.get('/programs'), API.get('/timetables'), API.get('/period-timings'),
                API.get('/faculty-assignments'), API.get('/audit-logs'), API.get('/dashboard-stats'),
                API.get('/faculty-availability'), API.get('/classroom-availability'), API.get('/timetable-conflicts'),
                API.get('/active-sessions')
            ]);

            setSubjects(sub.data);
            setFaculties(fac.data.filter(u => u.role === 'faculty'));
            setRooms(rm.data);
            setSemesters(sem.data);
            setSections(sec.data);
            setDepts(dept.data);
            setPrograms(prog.data);
            setTimetables(tt.data);
            setPeriods(pt.data.sort((a,b) => a.period_number - b.period_number));
            setAssignments(asgn.data);
            setAuditLogs(logs.data);
            setStats(sData.data);
            setFacAvailability(fAvail.data);
            setRoomAvailability(rAvail.data);
            setConflicts(conf.data);

            const sessions = {};
            if (Array.isArray(activeSess.data)) {
                activeSess.data.forEach(s => {
                    if (s?.room_id) sessions[s.room_id] = s;
                });
            }
            setActiveSessions(sessions);

            setLoading(false);
        } catch (err) {
            console.error("Enterprise synchronization failure:", err);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEverything();
        const interval = setInterval(fetchEverything, 10000); // Sync every 10s
        return () => clearInterval(interval);
    }, [fetchEverything]);

    useEffect(() => {
        let interval;
        if (showStartModal) {
            interval = setInterval(() => {
                const now = new Date();
                setSessionData(prev => ({
                    ...prev,
                    date: now.toISOString().split('T')[0],
                    start_time_display: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                }));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [showStartModal]);

    // --- VALIDATION RULES ---
    const getReadiness = () => {
        const checks = {
            departments: depts.length > 0,
            programs: programs.length > 0,
            semesters: semesters.length > 0,
            sections: sections.length > 0,
            subjects: subjects.length > 0,
            faculty: faculties.length > 0,
            mapping: assignments.length > 0,
            classrooms: rooms.filter(r => r.type === 'Classroom').length > 0,
            labs: rooms.filter(r => r.type === 'Lab').length > 0,
            weeklyHours: subjects.length > 0 && subjects.every(s => s.weekly_hours > 0)
        };
        const isReady = Object.values(checks).every(v => v === true);
        return { checks, isReady };
    };

    const readiness = getReadiness();

    // --- ACTIONS ---
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            let endpoint = '';
            switch(modalMode) {
                case 'DEPT': endpoint = '/departments'; break;
                case 'PROG': endpoint = '/programs'; break;
                case 'SEM': endpoint = '/semesters'; break;
                case 'SEC': endpoint = '/sections'; break;
                case 'SUBJECT': endpoint = '/subjects'; break;
                case 'FAC_MAP': endpoint = '/faculty-assignments'; break;
                case 'ROOM': endpoint = '/rooms'; break;
                case 'ACADEMIC_CYCLE': endpoint = '/settings/academic-cycle'; break;
                default: return;
            }

            if (modalMode === 'ACADEMIC_CYCLE') {
                await API.post(`${endpoint}?year=${formData.year}&sem_type=${formData.sem_type}`);
            } else {
                await API.post(endpoint, formData);
            }

            setShowModal(false);
            setFormData({});
            fetchEverything();
            alert("Record Updated Successfully.");
        } catch (err) {
            const detail = err.response?.data?.detail;
            let msg = "Registry Error";

            if (typeof detail === 'string') {
                msg = detail;
            } else if (Array.isArray(detail)) {
                msg = detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join("\n");
            } else if (err.response?.data?.message) {
                msg = err.response.data.message;
            } else if (err.message) {
                msg = err.message;
            }

            alert(msg);
        }
    };

    const runOptimizer = async () => {
        if (!readiness.isReady) {
            alert("Validation Error: Please complete mandatory registries before generation.");
            return;
        }
        setGenerating(true);
        try {
            await API.post('/generate-timetable');
            await fetchEverything();
            setActiveTab('MATRIX');
            alert("Institutional Matrix Optimized via OR-Tools.");
        } catch (err) {
            alert(err.response?.data?.detail || "Optimization Satisfaction Failure");
        } finally { setGenerating(false); }
    };

    const handleMovement = async (day, periodId) => {
        if (!draggedSlot) return;
        try {
            await API.put(`/timetables/move/${draggedSlot.id}`, { day_of_week: day, period_id: periodId });
            fetchEverything();
        } catch (err) {
            alert(err.response?.data?.detail || "Institutional Conflict Blocked Movement");
        }
        setDraggedSlot(null);
    };

    const handleStartClass = async (e) => {
        if (e) e.preventDefault();
        try {
            await API.post('/start-class', {
                room_id: selectedRoom?.id,
                faculty_id_display: sessionData.faculty_id_display,
                faculty_name: sessionData.faculty_name,
                department: sessionData.department,
                subject: sessionData.subject,
                section: sessionData.section,
                date: sessionData.date,
                start_time_display: sessionData.start_time_display,
                remarks: sessionData.remarks
            });
            setShowStartModal(false);
            fetchEverything();
            triggerPopup('Class Started');
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to start class');
        }
    };

    const handleEndClass = async (roomId) => {
        try {
            const activeRes = await API.get(`/active-session/${roomId}`);
            if (activeRes.data && activeRes.data.id) {
                await API.post(`/end-class/${activeRes.data.id}`);
                fetchEverything();
                triggerPopup('Class Ended');
            } else {
                fetchEverything();
            }
        } catch (err) {
            alert('Failed to end class');
        }
    };

    const isStale = (startTime) => {
        if (!startTime) return false;
        const start = new Date(startTime);
        const now = new Date();
        const diffMs = now - start;
        return diffMs > 7200000; // 2 Hours
    };

    const calculateDuration = (startTime) => {
        if (!startTime) return '0m';
        const start = new Date(startTime);
        const now = new Date();
        const diffMs = now - start;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `${diffMins}m`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
    };

    const getSubjectUIProps = (cat) => {
        const map = {
            'Core': 'from-indigo-600 to-blue-700 border-indigo-400',
            'Lab': 'from-rose-600 to-pink-700 border-rose-400',
            'Elective': 'from-emerald-600 to-teal-700 border-emerald-400',
            'VAC': 'from-violet-600 to-purple-700 border-violet-400'
        };
        return map[cat] || 'from-slate-600 to-slate-700 border-slate-400';
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950 font-black text-indigo-500 uppercase tracking-widest animate-pulse">
            Institutional Kernel Booting...
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] flex">
            {/* Content Hub */}
            <main className="flex-1 p-8 lg:p-12 overflow-y-auto max-h-screen custom-scrollbar">
                <header className="flex justify-between items-center mb-12">
                    <div>
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-1">Institutional ERP Module</p>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tightest uppercase italic">Time Table Manager</h1>
                    </div>
                    <div className="flex gap-4">
                        <div className={`px-6 py-4 rounded-2xl flex items-center gap-3 border transition-all ${readiness.isReady ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                            <div className={`w-2 h-2 rounded-full ${readiness.isReady ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Ready for Generation: {readiness.isReady ? 'YES' : 'NO'}</span>
                        </div>
                        <button onClick={runOptimizer} disabled={generating || !readiness.isReady} className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${generating || !readiness.isReady ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95'}`}>
                            {generating ? 'Optimizing Matrix...' : 'Run Auto-Scheduler'}
                        </button>
                    </div>
                </header>

                {/* --- TAB: STATS / SUMMARY --- */}
                {activeTab === 'STATS' && (
                    <div className="space-y-10">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {[
                                { label: 'Departments', val: depts.length, color: 'indigo' },
                                { label: 'Programs', val: programs.length, color: 'blue' },
                                { label: 'Active Faculty', val: faculties.length, color: 'violet' },
                                { label: 'Mapped Sections', val: sections.length, color: 'sky' },
                                { label: 'Classrooms', val: rooms.filter(r=>r.type==='Classroom').length, color: 'emerald' },
                                { label: 'Laboratories', val: rooms.filter(r=>r.type==='Lab').length, color: 'rose' },
                                { label: 'Subjects', val: subjects.length, color: 'amber' },
                                { label: 'Active Conflicts', val: conflicts.length, color: 'rose' }
                            ].map((s, i) => (
                                <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center">
                                    <p className={`text-4xl font-black text-${s.color}-600 mb-1`}>{s.val}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-2">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-8 italic">Registry Readiness Matrix</h2>
                                <div className="space-y-4">
                                    {Object.entries(readiness.checks).map(([key, passed]) => (
                                        <div key={key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{key.replace(/([A-Z])/g, ' $1')}</span>
                                            <div className={`flex items-center gap-3 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${passed ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
                                                {passed ? 'Requirement Met' : 'Mandatory Input Required'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                                <h3 className="text-lg font-black uppercase tracking-[0.2em] mb-8 italic border-b border-white/10 pb-4">Audit Frequency Hub</h3>
                                <div className="space-y-6 overflow-y-auto pr-4 custom-scrollbar flex-1 max-h-[350px]">
                                    {auditLogs.slice(0, 8).map((log, i) => (
                                        <div key={i} className="flex gap-4 items-start group">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-indigo-500/50 transition-all shadow-lg"><Clock className="w-4 h-4 text-indigo-400" /></div>
                                            <div>
                                                <p className="text-[11px] font-black uppercase tracking-tight leading-tight group-hover:text-indigo-400 transition-colors">{log.details}</p>
                                                <p className="text-[9px] text-white/30 mt-1 uppercase font-bold tracking-widest">{new Date(log.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: ACADEMIC MANAGEMENT --- */}
                {activeTab === 'ACADEMIC' && (
                    <div className="space-y-8">
                        {/* ACADEMIC DATA TABLES */}
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">{activeSubTab} Management</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Managed Registry Hub</p>
                                </div>
                                <button onClick={() => { setModalMode(activeSubTab); setShowModal(true); }} className="px-8 py-3.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black shadow-lg shadow-slate-200 transition-all">+ Register New Entry</button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100">
                                        {activeSubTab === 'DEPT' && <tr><th className="p-8">Name</th><th className="p-8">Code</th><th className="p-8">HOD</th><th className="p-8">Status</th></tr>}
                                        {activeSubTab === 'PROG' && <tr><th className="p-8">Program</th><th className="p-8">Code</th><th className="p-8">Dept</th><th className="p-8">Level</th><th className="p-8">Dur</th></tr>}
                                        {activeSubTab === 'SEM' && <tr><th className="p-8">Sem No</th><th className="p-8">Academic Year</th><th className="p-8">Cycle</th><th className="p-8">Status</th></tr>}
                                        {activeSubTab === 'SEC' && <tr><th className="p-8">Section Name</th><th className="p-8">Program</th><th className="p-8">Semester</th><th className="p-8">Strength</th></tr>}
                                        {activeSubTab === 'SUBJECT' && <tr><th className="p-8">Subject identity</th><th className="p-8">Classification</th><th className="p-8">Load Map</th><th className="p-8">Status</th></tr>}
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {activeSubTab === 'DEPT' && depts.map(d => <tr key={d.id} className="hover:bg-slate-50 transition-colors"><td className="p-8 font-black text-slate-800">{d.name}</td><td className="p-8 font-bold text-indigo-600">{d.code}</td><td className="p-8 font-bold text-slate-500">{faculties.find(f=>f.id===d.hod_id)?.name || 'UNASSIGNED'}</td><td className="p-8"><span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase border border-emerald-100">{d.status}</span></td></tr>)}
                                        {activeSubTab === 'PROG' && programs.map(p => <tr key={p.id} className="hover:bg-slate-50 transition-colors"><td className="p-8 font-black text-slate-800">{p.name}</td><td className="p-8 font-bold text-indigo-600">{p.code || 'N/A'}</td><td className="p-8 font-bold text-slate-400 uppercase">{depts.find(d=>d.id===p.department_id)?.name}</td><td className="p-8 font-black">{p.type}</td><td className="p-8 font-black text-slate-400 italic">{p.duration}Y</td></tr>)}
                                        {activeSubTab === 'SEM' && semesters.map(s => <tr key={s.id} className="hover:bg-slate-50 transition-colors"><td className="p-8 font-black text-slate-800 text-lg">Sem {s.number}</td><td className="p-8 font-bold text-slate-400 tracking-widest">2023-2024</td><td className="p-8 font-black text-indigo-600 uppercase italic">{s.number % 2 === 0 ? 'EVEN' : 'ODD'}</td><td className="p-8"><span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase">ACTIVE</span></td></tr>)}
                                        {activeSubTab === 'SEC' && sections.map(s => <tr key={s.id} className="hover:bg-slate-50 transition-colors"><td className="p-8 font-black text-slate-800">Section {s.name}</td><td className="p-8 font-bold text-slate-400">{programs.find(p=>p.id===(semesters.find(sem=>sem.id===s.semester_id)?.program_id))?.name}</td><td className="p-8 font-black text-indigo-600">Sem {semesters.find(sem=>sem.id===s.semester_id)?.number}</td><td className="p-8 font-black italic">{s.student_strength} students</td></tr>)}
                                        {activeSubTab === 'SUBJECT' && subjects.map(s => (
                                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-8"><div className="flex items-center gap-6"><div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getSubjectUIProps(s.category)} text-white flex items-center justify-center font-black text-lg italic shadow-lg shadow-current/20`}>{s.code?.charAt(0)}</div><div><p className="text-sm font-black text-slate-800 uppercase tracking-tight">{s.name}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Code: {s.code}</p></div></div></td>
                                                <td className="p-8"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${s.type==='Lab'?'bg-rose-50 text-rose-600 border-rose-100':'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>{s.category}</span></td>
                                                <td className="p-8">
                                                    <p className="text-[11px] font-black text-slate-700">Sem {semesters.find(sem=>sem.id===s.semester_id)?.number || 'N/A'}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{s.weekly_hours} Hours Per Week</p>
                                                </td>
                                                <td className="p-8"><span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase">{s.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: FACULTY MANAGEMENT --- */}
                {activeTab === 'FACULTY' && (
                    <div className="space-y-8">
                        {activeSubTab === 'MAPPING' && (
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                                    <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">Resource Allocation Matrix</h2>
                                    <button onClick={() => { setModalMode('FAC_MAP'); setShowModal(true); }} className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-105 transition-all">Map Subject to Faculty</button>
                                </div>
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest"><tr className="p-8 border-b border-slate-100"><th>Faculty Expert</th><th>Identification</th><th>Mapped Curriculum</th><th className="text-center">Operations</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">{faculties.map(f => {
                                        const myMaps = assignments.filter(a => a.faculty_id === f.id);
                                        return (
                                            <tr key={f.id} className="hover:bg-slate-50/50 transition duration-300">
                                                <td className="p-8"><div className="flex items-center gap-6"><div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200">{f.name.charAt(0)}</div><span className="font-black text-slate-800 uppercase tracking-tight">{f.name}</span></div></td>
                                                <td className="p-8"><span className="text-[11px] font-bold text-slate-400 tracking-[0.2em] uppercase">@{f.faculty_id}</span></td>
                                                <td className="p-8"><div className="flex flex-wrap gap-2">{myMaps.length > 0 ? myMaps.map(m => <span key={m.id} className="px-4 py-2 bg-white border border-indigo-100 text-indigo-600 rounded-xl text-[9px] font-black uppercase shadow-sm tracking-tight transition-transform hover:scale-105 cursor-default">{m.subject?.name} <span className="opacity-40 italic ml-1">S{m.semester_id}</span></span>) : <span className="text-[10px] text-slate-300 italic uppercase font-bold tracking-widest">Awaiting Curriculum Sync</span>}</div></td>
                                                <td className="p-8 text-center"><button onClick={() => { setFormData({faculty_id: f.id}); setModalMode('FAC_MAP'); setShowModal(true); }} className="px-6 py-2.5 border-2 border-slate-900 text-slate-900 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">Quick map</button></td>
                                            </tr>
                                        );
                                    })}</tbody>
                                </table>
                            </div>
                        )}

                        {activeSubTab === 'AVAILABILITY' && (
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-10">
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-8 italic">Faculty Availability Engine</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {facAvailability.map(f => (
                                        <div key={f.faculty_name} className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 group hover:border-indigo-200 transition-all hover:shadow-xl hover:shadow-indigo-50">
                                            <div className="flex justify-between items-start mb-6">
                                                <p className="font-black text-slate-800 uppercase tracking-tight">{f.faculty_name}</p>
                                                <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${f.availability_status === 'On Leave' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{f.availability_status}</span>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Assigned Hours</span><span className="text-indigo-600">{f.assigned_hours} / {f.weekly_workload} Hrs</span></div>
                                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000 shadow-lg" style={{width: `${(f.assigned_hours/f.weekly_workload)*100}%`}}></div>
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase text-center mt-4">Remaining Capacity: <span className="text-slate-800">{f.available_hours} Slots</span></p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB: SPATIAL MANAGEMENT --- */}
                {activeTab === 'SPATIAL' && (
                    <div className="space-y-8">
                        {activeSubTab === 'INFRASTRUCTURE' && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden h-fit">
                                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-indigo-50/20">
                                        <h2 className="text-lg font-black text-slate-800 uppercase italic">Institutional Rooms</h2>
                                        <button onClick={() => { setModalMode('ROOM'); setFormData({type: 'Classroom', capacity: 60, status: 'AVAILABLE'}); setShowModal(true); }} className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-100">+ New Room</button>
                                    </div>
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50/50 text-[9px] font-black text-slate-500 uppercase tracking-widest"><tr><th className="p-6">Room No</th><th className="p-6">Capacity</th><th className="p-6">Status</th><th className="p-6">Action</th></tr></thead>
                                        <tbody className="divide-y divide-slate-50">{rooms.filter(r=>r.type==='Classroom').map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-6">
                                                    <p className="font-black text-slate-800">{r.room_number}</p>
                                                    <p className="text-[8px] font-black uppercase text-slate-400">{r.building}</p>
                                                </td>
                                                <td className="p-6 font-bold text-slate-500">{r.capacity} Seats</td>
                                                <td className="p-6">
                                                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${r.status === 'IN_USE' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                        {r.status === 'IN_USE' ? 'Occupied' : 'Available'}
                                                    </span>
                                                </td>
                                                <td className="p-6">
                                                    {r.status === 'AVAILABLE' ? (
                                                        <button onClick={() => {
                                                            setSelectedRoom(r);
                                                            setSessionData({...sessionData, faculty_name: localStorage.getItem('name') || '', faculty_id_display: localStorage.getItem('user_id') || '', department: r.department || '', date: new Date().toISOString().split('T')[0] });
                                                            setShowStartModal(true);
                                                        }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest">Start Class</button>
                                                    ) : (
                                                        (['admin', 'dean', 'principal', 'hod'].includes(role) || activeSessions[r.id]?.faculty_user_id === currentUserId || isStale(activeSessions[r.id]?.start_time)) && (
                                                            <button onClick={() => handleEndClass(r.id)} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest">End Session</button>
                                                        )
                                                    )}
                                                </td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden h-fit">
                                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-rose-50/20">
                                        <h2 className="text-lg font-black text-slate-800 uppercase italic">Laboratories</h2>
                                        <button onClick={() => { setModalMode('ROOM'); setFormData({type: 'Lab', capacity: 30, status: 'AVAILABLE'}); setShowModal(true); }} className="px-5 py-2 bg-rose-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-rose-100">+ New Lab</button>
                                    </div>
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50/50 text-[9px] font-black text-slate-500 uppercase tracking-widest"><tr><th className="p-6">Lab No</th><th className="p-6">Capacity</th><th className="p-6">Status</th><th className="p-6">Action</th></tr></thead>
                                        <tbody className="divide-y divide-slate-50">{rooms.filter(r=>r.type==='Lab').map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-6">
                                                    <p className="font-black text-slate-800">{r.room_number}</p>
                                                    <p className="text-[8px] font-black uppercase text-slate-400">{r.building}</p>
                                                </td>
                                                <td className="p-6 font-bold text-slate-500">{r.capacity} Stns</td>
                                                <td className="p-6">
                                                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${r.status === 'IN_USE' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                        {r.status === 'IN_USE' ? 'Occupied' : 'Available'}
                                                    </span>
                                                </td>
                                                <td className="p-6">
                                                    {r.status === 'AVAILABLE' ? (
                                                        <button onClick={() => {
                                                            setSelectedRoom(r);
                                                            setSessionData({...sessionData, faculty_name: localStorage.getItem('name') || '', faculty_id_display: localStorage.getItem('user_id') || '', department: r.department || '', date: new Date().toISOString().split('T')[0] });
                                                            setShowStartModal(true);
                                                        }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest">Start Class</button>
                                                    ) : (
                                                        (['admin', 'dean', 'principal', 'hod'].includes(role) || activeSessions[r.id]?.faculty_user_id === currentUserId || isStale(activeSessions[r.id]?.start_time)) && (
                                                            <button onClick={() => handleEndClass(r.id)} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest">End Session</button>
                                                        )
                                                    )}
                                                </td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeSubTab === 'OCCUPANCY' && (
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-10">
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-8 italic">Institutional spatial Utilization</h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {roomAvailability.map(r => (
                                        <div key={r.room_number} className="aspect-square bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col items-center justify-center p-4 group hover:bg-white hover:border-indigo-500 hover:shadow-2xl transition-all duration-500 cursor-default">
                                            <p className="text-xs font-black text-slate-900 group-hover:text-indigo-600">{r.room_number}</p>
                                            <div className="mt-4 w-12 h-12 rounded-full border-4 border-slate-200 flex items-center justify-center relative overflow-hidden group-hover:border-indigo-100 transition-colors">
                                                <div className="absolute inset-0 bg-indigo-600" style={{top: `${100-r.utilization_percentage}%`}}></div>
                                                <span className="relative z-10 text-[9px] font-black group-hover:text-white transition-colors">{Math.round(r.utilization_percentage)}%</span>
                                            </div>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-3 tracking-tighter opacity-60">{r.status}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB: SETTINGS --- */}
                {activeTab === 'SETTINGS' && (
                    <div className="max-w-4xl mx-auto space-y-10">
                        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center mb-10">
                                <h2 className="text-2xl font-black text-slate-800 uppercase italic">Institutional Parameters</h2>
                                <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg uppercase tracking-widest border border-indigo-100 shadow-sm">v4.0.1 Stable Kernel</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Academic Cycle</label>
                                        <select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm outline-none border-2 border-transparent focus:border-indigo-500 shadow-inner transition-all"><option>2023-2024 (ODD Semester)</option><option>2023-2024 (EVEN Semester)</option></select>
                                    </div>
                                    <div className="p-8 bg-indigo-600 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-all"></div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Engine Operational Status</p>
                                        <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div><p className="text-lg font-black italic tracking-tight">READY FOR GENERATION</p></div>
                                        <p className="text-[9px] font-medium text-white/50 mt-4 leading-relaxed uppercase">All registry prerequisites have been validated against the Google OR-Tools constraint matrix.</p>
                                    </div>
                                </div>
                                <div className="space-y-6 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 h-fit">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Precision timing Grid</h3>
                                    {periods.map(p => (
                                        <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-200 last:border-0">
                                            <span className="text-[10px] font-black text-slate-600 uppercase">{p.type === 'CLASS' ? `Period ${p.period_number}` : p.type}</span>
                                            <span className="text-[10px] font-bold text-indigo-500 font-mono tracking-widest">{p.start_time} - {p.end_time}</span>
                                        </div>
                                    ))}
                                    <button onClick={() => setModalMode('SETTINGS')} className="w-full mt-6 py-4 bg-white border border-slate-200 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm">Modify Institutional Cycle</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: MATRIX GRID (RETAINED) --- */}
                {activeTab === 'MATRIX' && (
                    <div className="space-y-6">
                        {/* Matrix Filter hub */}
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex gap-4">
                                <select className="bg-slate-50 border-none rounded-xl px-6 py-2 text-[10px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500" value={filterSem} onChange={e => setFilterSem(e.target.value)}>
                                    <option value="">Semester Matrix...</option>
                                    {semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number} - {programs.find(p=>p.id===s.program_id)?.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* The Grid */}
                        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900 text-white font-black text-[9px] uppercase tracking-widest">
                                            <th className="p-6 w-40 bg-slate-950 border-r border-white/5">Order</th>
                                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(d => <th key={d} className="p-6 border-r border-white/5 text-center">{d}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {periods.map(p => (
                                            <tr key={p.id} className={p.is_break ? 'bg-slate-50/50 italic' : 'hover:bg-slate-50/30 transition-colors h-32'}>
                                                <td className="p-6 bg-slate-50 border-r border-slate-100">
                                                    <p className="text-[10px] font-black text-slate-900 uppercase leading-none">{p.is_break ? p.type : `Period ${p.period_number}`}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 mt-2 tracking-widest">{p.start_time} - {p.end_time}</p>
                                                </td>
                                                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => {
                                                    const slot = p.is_break ? null : timetables.find(t => t.day_of_week === day && t.period_id === p.id && (!filterSem || t.semester_id === parseInt(filterSem)) && (!filterFac || t.faculty_id === parseInt(filterFac)));
                                                    return (
                                                        <td key={`${day}-${p.id}`} className={`p-2 border-r border-slate-100 align-top min-w-[200px] ${p.is_break ? 'bg-slate-100/20' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => !p.is_break && handleMovement(day, p.id)}>
                                                            {slot ? (
                                                                <div draggable onDragStart={e => { setDraggedSlot(slot); e.dataTransfer.setData('id', slot.id); }} className={`p-5 rounded-2xl bg-gradient-to-br ${getSubjectUIProps(subjects.find(s => s.id === slot.subject_id)?.category || 'Core')} text-white h-full shadow-lg cursor-grab active:cursor-grabbing group transition-transform hover:scale-[1.02] relative overflow-hidden`}>
                                                                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl group-hover:bg-white/20 transition-all"></div>
                                                                    <p className="text-[10px] font-black uppercase tracking-widest mb-1">{slot.subject_name}</p>
                                                                    <p className="text-[8px] font-bold opacity-80 uppercase">{slot.faculty_name}</p>
                                                                    <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-[7px] font-black uppercase tracking-tighter">
                                                                        <span>RM: {slot.room_number}</span>
                                                                        <span className="italic opacity-60">S{slot.semester_number} Sec {slot.section}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (!p.is_break && <div className="w-full h-full border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center font-black text-[8px] text-slate-200 uppercase tracking-widest hover:border-indigo-100 hover:text-indigo-200 cursor-pointer">Open Slot</div>)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* --- CONSOLIDATED MASTER MODAL --- */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden border border-white/20">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                            <h3 className="font-black uppercase tracking-widest italic">{modalMode} REGISTRY HUB</h3>
                            <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <form className="p-10 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar" onSubmit={handleFormSubmit}>
                            {modalMode === 'DEPT' && (
                                <>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Dept Name</label><input className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none border-2 border-transparent focus:border-indigo-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required/></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Code</label><input className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} required/></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">HOD</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.hod_id || ''} onChange={e => setFormData({...formData, hod_id: parseInt(e.target.value)})}>
                                            <option value="">Select HOD...</option>{faculties.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                                        </select></div>
                                    </div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Status</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.status || 'Active'} onChange={e => setFormData({...formData, status: e.target.value})}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
                                </>
                            )}

                            {modalMode === 'PROG' && (
                                <>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Program Name</label><input className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none border-2 border-transparent focus:border-indigo-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required/></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Program Code</label><input className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} required/></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Type</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.type || ''} onChange={e => setFormData({...formData, type: e.target.value})} required><option value="">Select...</option><option value="UG">UG</option><option value="PG">PG</option></select></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Department</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.department_id || ''} onChange={e => setFormData({...formData, department_id: parseInt(e.target.value)})} required><option value="">Select Dept...</option>{depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Duration (Yrs)</label><input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.duration || 3} onChange={e => setFormData({...formData, duration: parseInt(e.target.value)})} required/></div>
                                    </div>
                                </>
                            )}

                            {modalMode === 'SEM' && (
                                <>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Semester Number</label><input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none border-2 border-transparent focus:border-indigo-500" value={formData.number || ''} onChange={e => setFormData({...formData, number: parseInt(e.target.value)})} required/></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Academic Year</label><input className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" placeholder="e.g. 2023-2024" /></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Program</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.program_id || ''} onChange={e => setFormData({...formData, program_id: parseInt(e.target.value)})} required><option value="">Select Program...</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                                    </div>
                                </>
                            )}

                            {modalMode === 'SEC' && (
                                <>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Section Name</label><input className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none border-2 border-transparent focus:border-indigo-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. A" required/></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Semester</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.semester_id || ''} onChange={e => setFormData({...formData, semester_id: parseInt(e.target.value)})} required><option value="">Select Sem...</option>{semesters.map(s=><option key={s.id} value={s.id}>Sem {s.number} ({programs.find(p=>p.id===s.program_id)?.name})</option>)}</select></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Student Strength</label><input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.student_strength || 60} onChange={e => setFormData({...formData, student_strength: parseInt(e.target.value)})} required/></div>
                                    </div>
                                </>
                            )}

                            {modalMode === 'SUBJECT' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Identity Code</label><input className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} required/></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Category</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.category || 'Core'} onChange={e => setFormData({...formData, category: e.target.value})}><option value="Core">Core</option><option value="Lab">Lab</option><option value="Elective">Elective</option><option value="VAC">VAC</option></select></div>
                                    </div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Subject Name</label><input className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none border-2 border-transparent focus:border-indigo-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required/></div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Type</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.type || 'Theory'} onChange={e => setFormData({...formData, type: e.target.value})}><option value="Theory">Theory</option><option value="Lab">Lab</option></select></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Weekly Hrs</label><input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.weekly_hours || 3} onChange={e => setFormData({...formData, weekly_hours: parseInt(e.target.value)})} required/></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Credits</label><input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.credits || 3} onChange={e => setFormData({...formData, credits: parseInt(e.target.value)})} required/></div>
                                    </div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Assigned Semester</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.semester_id || ''} onChange={e => setFormData({...formData, semester_id: parseInt(e.target.value)})} required><option value="">Select...</option>{semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number} ({programs.find(p=>p.id===s.program_id)?.name})</option>)}</select></div>
                                </>
                            )}

                            {modalMode === 'FAC_MAP' && (
                                <>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Faculty</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.faculty_id || ''} onChange={e => setFormData({...formData, faculty_id: parseInt(e.target.value)})} required><option value="">Select Faculty...</option>{faculties.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Subject</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.subject_id || ''} onChange={e => {
                                        const sub = subjects.find(s=>s.id===parseInt(e.target.value));
                                        setFormData({...formData, subject_id: parseInt(e.target.value), semester_id: sub?.semester_id});
                                    }} required><option value="">Select Subject...</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name} [Sem {s.semester_id}]</option>)}</select></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Section</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.section || ''} onChange={e => setFormData({...formData, section: e.target.value})} required><option value="">Select Section...</option>{['A', 'B', 'C'].map(s=><option key={s} value={s}>Section {s}</option>)}</select></div>
                                </>
                            )}

                            {modalMode === 'ROOM' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Room No</label><input className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none border-2 border-transparent focus:border-indigo-500" value={formData.room_number || ''} onChange={e => setFormData({...formData, room_number: e.target.value})} required/></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Capacity</label><input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.capacity || 60} onChange={e => setFormData({...formData, capacity: parseInt(e.target.value)})} required/></div>
                                    </div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Type</label><select className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.type || 'Classroom'} onChange={e => setFormData({...formData, type: e.target.value})} required><option value="Classroom">Classroom</option><option value="Lab">Laboratory</option></select></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Building</label><input className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.building || ''} onChange={e => setFormData({...formData, building: e.target.value})} required/></div>
                                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Floor</label><input className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xs outline-none" value={formData.floor || ''} onChange={e => setFormData({...formData, floor: e.target.value})} required/></div>
                                    </div>
                                </>
                            )}

                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 border-2 border-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors hover:bg-slate-50">Discard</button>
                                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:scale-[1.02] transition-all">Confirm Registry</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* --- START SESSION MODAL --- */}
            {showStartModal && (
                <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-[#1e1e1e] rounded-[2.5rem] w-full max-w-2xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col border border-white/10">
                        <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                            <h2 className="text-3xl font-black uppercase tracking-tight relative z-10 italic">Start Session</h2>
                            <p className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.3em] mt-1 relative z-10">Activating Space {selectedRoom?.room_number}</p>
                        </div>
                        <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Faculty Name</label>
                                <input className="w-full p-5 bg-white/5 border-2 border-transparent focus:border-indigo-600 rounded-2xl font-bold text-white outline-none transition-all" value={sessionData.faculty_name} onChange={(e) => setSessionData({...sessionData, faculty_name: e.target.value})} required/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identity ID</label>
                                <input className="w-full p-5 bg-white/5 border-2 border-transparent focus:border-indigo-600 rounded-2xl font-bold text-white outline-none transition-all" value={sessionData.faculty_id_display} onChange={(e) => setSessionData({...sessionData, faculty_id_display: e.target.value})} required/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Institutional Dept</label>
                                <select className="w-full p-5 bg-[#2a2a2a] border-2 border-transparent rounded-2xl font-bold text-white outline-none appearance-none" value={sessionData.department} onChange={(e) => setSessionData({...sessionData, department: e.target.value, subject: ''})} required>
                                    <option value="">Select Dept</option>
                                    {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Academic Subject</label>
                                <select className="w-full p-5 bg-[#2a2a2a] border-2 border-transparent rounded-2xl font-bold text-white outline-none appearance-none" value={sessionData.subject} onChange={(e) => setSessionData({...sessionData, subject: e.target.value})} required disabled={!sessionData.department}>
                                    <option value="">Select Subject</option>
                                    {subjects.filter(s => depts.find(d => d.id === s.department_id)?.name === sessionData.department || !sessionData.department).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Section</label>
                                <select className="w-full p-5 bg-[#2a2a2a] border-2 border-transparent rounded-2xl font-bold text-white outline-none appearance-none" value={sessionData.section} onChange={(e) => setSessionData({...sessionData, section: e.target.value})} required>
                                    <option value="">Select Section</option>
                                    {['A','B','C','D','E','F'].map(s => <option key={s} value={s}>Section {s}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Timestamp</label>
                                    <input type="time" className="w-full p-5 bg-white/5 border-none rounded-2xl font-bold text-white outline-none" value={sessionData.start_time_display} onChange={(e) => setSessionData({...sessionData, start_time_display: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-[#1a1a1a] border-t border-white/5 flex gap-4">
                            <button onClick={() => setShowStartModal(false)} className="flex-1 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] text-slate-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                            <button onClick={handleStartClass} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all">Activate Space</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Popup */}
            {statusPopup.show && (
                <div className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-white/20 px-10 py-5 rounded-[2rem] shadow-2xl animate-in zoom-in duration-300">
                        <div className="flex items-center space-x-4">
                            <div className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/40">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-white font-black text-xl tracking-tightest uppercase italic">{statusPopup.message}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimetableManager;
