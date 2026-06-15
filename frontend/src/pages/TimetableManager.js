import React, { useEffect, useState, useCallback } from 'react';
import API from '../api';

const TimetableManager = () => {
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [view, setView] = useState('DASHBOARD');
    const [cycleFilter, setCycleFilter] = useState('ALL');

    const [subjects, setSubjects] = useState([]);
    const [faculties, setFaculties] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [depts, setDepts] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [timetables, setTimetables] = useState([]);
    const [workingDays, setWorkingDays] = useState([]);
    const [periods, setPeriods] = useState([]);

    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');
    const [semesterType, setSemesterType] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState(null);

    const [newSubject, setNewSubject] = useState({ name: '', code: '', type: 'Theory', credits: 3, weekly_hours: 3, semester_id: '', department_id: '' });
    const [editingSubject, setEditingSubject] = useState(null);
    const [newAssignment, setNewAssignment] = useState({ subject_id: '', semester_id: '', section: '' });

    const [newDept, setNewDept] = useState({ name: '' });
    const [newProg, setNewProg] = useState({ name: '', type: 'UG', department_id: '' });
    const [newSem, setNewSem] = useState({ number: '', program_id: '', is_active: true });

    const role = localStorage.getItem('role')?.toLowerCase();

    const fetchData = useCallback(async () => {
        try {
            const safeFetch = async (url) => {
                try {
                    const res = await API.get(url);
                    return res.data;
                } catch (e) {
                    console.warn(`Failed to fetch ${url}:`, e);
                    return [];
                }
            };

            const [sData, subData, userData, rData, dData, pData, semData, tData, wdData, ptData] = await Promise.all([
                safeFetch('/dashboard-stats'),
                safeFetch('/subjects'),
                safeFetch('/users_list'),
                safeFetch('/rooms'),
                safeFetch('/departments'),
                safeFetch('/programs'),
                safeFetch('/semesters'),
                safeFetch('/timetables'),
                safeFetch('/working-days'),
                safeFetch('/period-timings')
            ]);

            setStats(sData || {});
            setSubjects(subData || []);
            setFaculties(Array.isArray(userData) ? userData.filter(u => u.role === 'faculty') : []);
            setRooms(rData || []);
            setDepts(dData || []);
            setPrograms(pData || []);
            setSemesters(semData || []);
            setTimetables(tData || []);
            setWorkingDays(wdData || []);

            const sortedPt = (ptData || []).sort((a, b) => {
                const toMin = (t) => {
                    let [h, m] = (t || "00:00").split(':').map(Number);
                    if (h < 8) h += 12; // Handle AM/PM logic for 12h formats (e.g., 01:30 -> 13:30)
                    return h * 60 + m;
                };
                return toMin(a.start_time) - toMin(b.start_time);
            });
            setPeriods(sortedPt);
            setLoading(false);
        } catch (err) {
            console.error("Data fetch failed:", err);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleGenerate = async () => {
        if (semesters.length === 0) {
            alert("Cannot Generate: No Semesters found in registry. Please use the 'Auto-Fix Registry' button below.");
            return;
        }
        if (subjects.length === 0) {
            alert("Cannot Generate: Curriculum is empty. Please add subjects first.");
            return;
        }

        setGenerating(true);
        try {
            const params = {};
            if (selectedSemester) params.semester_id = selectedSemester;
            if (semesterType) params.semester_type = semesterType;
            const queryParams = new URLSearchParams(params).toString();
            await API.post(`/generate-timetable?${queryParams}`);
            await fetchData();
            setView('VIEW');
            alert('Institutional Timetable Generated Successfully!');
        } catch (err) {
            alert('Generation Failed: ' + (err.response?.data?.detail || 'Verify Data Registry'));
        } finally {
            setGenerating(false);
        }
    };

    const handleDeleteTimetable = async () => {
        if (window.confirm("Purge Master Schedule? This action cannot be undone.")) {
            try {
                await API.delete('/timetables');
                await fetchData();
                alert("Timetable Purged");
            } catch (err) { alert("Action failed"); }
        }
    };

    const handleAddSubject = async (e) => {
        if (e) e.preventDefault();
        try {
            if (editingSubject) {
                await API.put(`/subjects/${editingSubject.id}`, newSubject);
                alert('Subject Updated');
            } else {
                await API.post('/subjects', newSubject);
                alert('Subject Registered');
            }
            setShowModal(false);
            setEditingSubject(null);
            setNewSubject({ name: '', code: '', type: 'Theory', credits: 3, weekly_hours: 3, semester_id: '', department_id: '' });
            fetchData();
        } catch (err) { alert("Error saving subject"); }
    };

    const handleDeleteSubject = async (id) => {
        if (window.confirm("Delete this subject? This will also remove its timetable entries.")) {
            try {
                await API.delete(`/subjects/${id}`);
                fetchData();
                alert("Subject Purged");
            } catch (err) { alert("Action failed: Subject may have active dependencies."); }
        }
    };

    const handleAssignFaculty = async (e) => {
        if (e) e.preventDefault();
        try {
            await API.post('/faculty-assignments', {
                faculty_id: selectedFaculty?.id,
                subject_id: parseInt(newAssignment.subject_id),
                semester_id: parseInt(newAssignment.semester_id),
                section: newAssignment.section
            });
            setShowModal(false);
            fetchData();
            alert("Faculty Assigned Successfully");
        } catch (err) { alert("Assignment failed"); }
    };

    const handleSubjectSelect = (subjectId) => {
        const sub = subjects.find(s => parseInt(s.id) === parseInt(subjectId));
        if (sub) {
            setNewAssignment({
                ...newAssignment,
                subject_id: subjectId,
                semester_id: sub.semester_id
            });
        } else {
            setNewAssignment({ ...newAssignment, subject_id: subjectId, semester_id: '' });
        }
    };

    const getSubjectColor = (name, type) => {
        const n = name?.toLowerCase() || '';
        const t = type?.toLowerCase() || '';
        if (n.includes('practical') || n.includes('lab') || t.includes('practical')) return 'bg-amber-50 border-amber-200 text-amber-800';
        if (n.includes('community engagement') || n.includes('social responsibility')) return 'bg-indigo-50 border-indigo-200 text-indigo-800';
        return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    };

    if (loading) return <div className="p-10 text-center animate-pulse font-black text-indigo-400 tracking-widest uppercase">Initializing CMS Intelligence...</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-[#f8fafc] min-h-screen print:bg-white print:p-0">
            <header className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 print:hidden">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tightest">Timetable Manager</h1>
                    <div className="flex items-center space-x-2 mt-2">
                        <span className="h-1.5 w-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[9px]">Automated Academic Engine • KAHE CMS</p>
                    </div>
                </div>

                <nav className="flex items-center bg-white p-1 rounded-[1.25rem] shadow-xl shadow-slate-200/40 border border-slate-200 overflow-x-auto no-scrollbar max-w-full">
                    {[
                        { id: 'DASHBOARD', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
                        { id: 'SUBJECTS', label: 'Curriculum', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                        { id: 'FACULTY', label: 'Allocation', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
                        { id: 'ROOMS', label: 'Spaces', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5' },
                        { id: 'GENERATOR', label: 'Engine', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                        { id: 'VIEW', label: 'Matrix', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                        { id: 'SETTINGS', label: 'Config', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                    ].filter(tab => {
                        const roles = {
                            'DASHBOARD': ['admin', 'dean', 'hod'],
                            'SUBJECTS': ['admin', 'dean', 'hod'],
                            'FACULTY': ['admin', 'dean', 'hod'],
                            'ROOMS': ['admin', 'dean', 'hod'],
                            'GENERATOR': ['admin', 'dean'],
                            'VIEW': ['admin', 'dean', 'hod', 'faculty', 'student'],
                            'SETTINGS': ['admin', 'dean']
                        };
                        return roles[tab.id].includes(role);
                    }).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setView(tab.id)}
                            className={`flex items-center space-x-2 px-4 py-2.5 rounded-[1rem] text-[10px] font-black tracking-widest uppercase transition-all duration-300 relative group ${
                                view === tab.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200/50'
                                : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
                            }`}
                        >
                            <svg className={`h-4 w-4 ${view === tab.id ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={tab.icon} />
                            </svg>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </header>

            <main className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {view === 'DASHBOARD' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Departments', value: depts.length, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5', color: 'text-blue-600', bg: 'bg-blue-50' },
                            { label: 'Academic Cycle', value: semesters.length, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7', color: 'text-violet-600', bg: 'bg-violet-50' },
                            { label: 'Generated Slots', value: timetables.length, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            { label: 'Conflicts Found', value: stats.conflict_alerts || 0, icon: 'M12 8v4m0 4h.01', color: 'text-rose-600', bg: 'bg-rose-50' }
                        ].map((item, idx) => (
                            <div key={idx} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col items-center text-center group hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
                                <div className={`p-4 rounded-[1.5rem] mb-4 ${item.bg} ${item.color} group-hover:scale-110 transition-transform duration-500`}>
                                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                                </div>
                                <p className={`text-4xl font-black ${item.color}`}>{item.value}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">{item.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {view === 'SUBJECTS' && (
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-8 flex justify-between items-center border-b border-slate-100">
                            <div className="flex items-center space-x-8">
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Core Curriculum</h2>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Manage Institutional Subjects</p>
                                </div>
                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                    {['ALL', 'ODD', 'EVEN'].map(cycle => (
                                        <button
                                            key={cycle}
                                            onClick={() => setCycleFilter(cycle)}
                                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${cycleFilter === cycle ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {cycle}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {role === 'admin' && <button onClick={() => { setModalType('SUBJECT'); setShowModal(true); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">+ Register Subject</button>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[9px] font-black text-slate-500 uppercase tracking-[0.25em]">
                                    <tr><th className="p-8">Subject Identity</th><th className="p-8">Classification</th><th className="p-8">Load Map</th><th className="p-8 text-center">Actions</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {subjects.filter(s => {
                                        if (cycleFilter === 'ALL') return true;
                                        const sem = semesters.find(sem => sem.id === s.semester_id);
                                        if (!sem) return true;
                                        return cycleFilter === 'ODD' ? sem.number % 2 !== 0 : sem.number % 2 === 0;
                                    }).map(s => {
                                        const sem = semesters.find(sem => sem.id === s.semester_id);
                                        const isOdd = sem ? sem.number % 2 !== 0 : null;
                                        return (
                                            <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group text-sm">
                                                <td className="p-8">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-xs text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all">{s.code?.charAt(0)}</div>
                                                        <div>
                                                            <p className="font-black text-slate-800 uppercase">{s.name}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">Code: {s.code}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-8"><span className={`text-[8px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${s.type === 'Practical' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{s.type}</span></td>
                                                <td className="p-8">
                                                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.1em]">Semester {s.semester_id || 'N/A'}</p>
                                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{isOdd === null ? '' : (isOdd ? 'Odd Cycle' : 'Even Cycle')}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{s.weekly_hours} Hours / Week</p>
                                                </td>
                                                <td className="p-8">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingSubject(s);
                                                                setNewSubject({ ...s });
                                                                setModalType('SUBJECT');
                                                                setShowModal(true);
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSubject(s.id)}
                                                            className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {view === 'FACULTY' && (
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-8 border-b border-slate-100">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Faculty Resource Mapping</h2>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Allocate subjects to professors</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                    <tr><th className="p-8">Faculty</th><th className="p-8">ID</th><th className="p-8">Specialization</th><th className="p-8 text-center">Operation</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {faculties.map(f => (
                                        <tr key={f.id} className="hover:bg-slate-50/50 transition text-sm">
                                            <td className="p-8">
                                                <div className="flex items-center space-x-3">
                                                    <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs">{f.name.charAt(0)}</div>
                                                    <span className="font-black text-slate-800 uppercase">{f.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-8"><span className="text-[10px] font-bold text-slate-400 tracking-wider">@{f.faculty_id}</span></td>
                                            <td className="p-8"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg">Institutional Faculty</span></td>
                                            <td className="p-8 text-center">
                                                <button
                                                    onClick={() => { setSelectedFaculty(f); setModalType('FACULTY_ASSIGN'); setShowModal(true); }}
                                                    className="px-6 py-2.5 border-2 border-indigo-600 text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] hover:bg-indigo-600 hover:text-white transition-all duration-300"
                                                >
                                                    Assign Load
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {view === 'ROOMS' && (
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-8 border-b border-slate-100">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Institutional Rooms</h2>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Managed classroom & lab spaces</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                    <tr><th className="p-8">Room Number</th><th className="p-8">Building / Floor</th><th className="p-8">Type</th><th className="p-8">Capacity</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rooms.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50/50 transition text-sm">
                                            <td className="p-8 font-black text-slate-800 uppercase tracking-widest">{r.room_number}</td>
                                            <td className="p-8 text-sm font-bold text-slate-500 uppercase tracking-tighter">{r.building} • FL {r.floor}</td>
                                            <td className="p-8"><span className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.2em] bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">{r.type}</span></td>
                                            <td className="p-8 text-sm font-black text-slate-700 italic">{r.capacity} Seats</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {view === 'GENERATOR' && (
                    <div className="max-w-4xl mx-auto space-y-8">
                        {/* MAIN ENGINE CARD */}
                        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-slate-200/60 border border-slate-200">
                            <div className="text-center mb-10">
                                <div className="h-20 w-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100">
                                    <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tightest mb-2 italic">CMS ENGINE</h2>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.5em]">Automated Scheduling</p>
                            </div>

                            <div className="space-y-8">
                                <div className={`p-10 rounded-[3rem] text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border relative overflow-hidden transition-all duration-500 ${semesters.length > 0 && subjects.length > 0 ? 'bg-slate-900 border-white/5' : 'bg-rose-900 border-rose-400/20'}`}>
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl"></div>
                                    <div className="text-center md:text-left relative z-10">
                                        <p className="font-black text-xl mb-1 tracking-tight">
                                            {semesters.length > 0 && subjects.length > 0 ? 'Process Master Schedule' : 'Registry Incomplete'}
                                        </p>
                                        <p className="text-white/40 text-[9px] font-bold uppercase tracking-[0.3em]">
                                            {semesters.length > 0 && subjects.length > 0 ? 'Validating Dependencies...' : 'Setup required before generation'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={generating || semesters.length === 0 || subjects.length === 0}
                                        className="px-12 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale relative z-10"
                                    >
                                        {generating ? 'Processing Matrix...' : 'Run Generator'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-200 flex flex-col gap-4">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Configuration</p>
                                        <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-slate-700 outline-none shadow-sm focus:border-indigo-500 text-xs transition-all" value={semesterType} onChange={(e) => { setSemesterType(e.target.value); setSelectedSemester(''); }}>
                                            <option value="">Cycle: All Semesters</option>
                                            <option value="ODD">Odd Cycle (1, 3, 5...)</option>
                                            <option value="EVEN">Even Cycle (2, 4, 6...)</option>
                                        </select>
                                        <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-slate-700 outline-none shadow-sm focus:border-indigo-500 text-xs transition-all" value={selectedSemester} onChange={(e) => { setSelectedSemester(e.target.value); setSemesterType(''); }}>
                                            <option value="">Specific Registry...</option>
                                            {semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number} - {programs.find(p => p.id === parseInt(s.program_id))?.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-200 flex flex-col justify-center items-center text-center">
                                        {semesters.length > 0 && subjects.length > 0 ? (
                                            <>
                                                <div className="h-14 w-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                                <p className="text-emerald-700 font-black text-sm uppercase tracking-tight">Registry Ready</p>
                                            </>
                                        ) : (
                                            <>
                                                <div className="h-14 w-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                </div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Alert</p>
                                                <p className="text-amber-700 font-black text-[9px] uppercase tracking-tighter leading-tight mb-2">Missing {semesters.length === 0 ? 'Structure' : 'Subjects'}</p>
                                                {semesters.length === 0 && (
                                                    <button onClick={async () => { await API.post('/seed-institution'); fetchData(); }} className="text-[8px] font-black bg-slate-900 text-white px-3 py-1 rounded-lg uppercase hover:bg-black transition-all">Auto-Fix Registry</button>
                                                )}
                                                {semesters.length > 0 && subjects.length === 0 && (
                                                    <button onClick={() => setView('SUBJECTS')} className="text-[8px] font-black bg-indigo-600 text-white px-3 py-1 rounded-lg uppercase hover:bg-indigo-700 transition-all">Add Curriculum</button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* STEP-BY-STEP GUIDE (Only shows if incomplete) */}
                        {(semesters.length === 0 || subjects.length === 0) && (
                            <div className="bg-indigo-50 border-2 border-indigo-100 p-8 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-700">
                                <h3 className="text-indigo-900 font-black text-xs uppercase tracking-widest mb-6 flex items-center">
                                    <span className="bg-indigo-600 text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px] mr-2">!</span>
                                    Quick Startup Guide
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className={`p-6 rounded-2xl bg-white border-b-2 transition-all ${semesters.length > 0 ? 'border-emerald-500 opacity-40' : 'border-indigo-200'}`}>
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Step 1</p>
                                        <p className="text-[11px] font-bold text-slate-700 mb-3">Initialize the Academic Structure</p>
                                        {semesters.length === 0 && <button onClick={async () => { await API.post('/seed-institution'); fetchData(); }} className="text-[9px] font-black text-indigo-600 uppercase underline">Click here to start</button>}
                                    </div>
                                    <div className={`p-6 rounded-2xl bg-white border-b-2 transition-all ${subjects.length > 0 ? 'border-emerald-500 opacity-40' : 'border-indigo-200'}`}>
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Step 2</p>
                                        <p className="text-[11px] font-bold text-slate-700 mb-3">Add subjects to the Curriculum</p>
                                        {subjects.length === 0 && <button onClick={() => setView('SUBJECTS')} className="text-[9px] font-black text-indigo-600 uppercase underline">Add subjects now</button>}
                                    </div>
                                    <div className="p-6 rounded-2xl bg-white border-b-2 border-indigo-200">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Step 3</p>
                                        <p className="text-[11px] font-bold text-slate-700 mb-3">Run the Automated Generator</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Wait for registry setup</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {view === 'VIEW' && (
                    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-300/50 border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tightest uppercase italic">Master Schedule</h2>
                                <div className="flex items-center space-x-6 mt-2">
                                    <div className="flex items-center space-x-2">
                                        <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.3em]">Live Matrix</p>
                                    </div>
                                    <select
                                        className="bg-slate-100 border-none rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        value={selectedSemester}
                                        onChange={(e) => setSelectedSemester(e.target.value)}
                                    >
                                        <option value="">Select Semester View...</option>
                                        {semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number} - {programs.find(p => p.id === parseInt(s.program_id))?.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 print:hidden">
                                {role === 'admin' && (
                                    <button onClick={handleDeleteTimetable} className="bg-rose-100 text-rose-700 px-6 py-3 rounded-xl text-[9px] font-black tracking-[0.2em] uppercase hover:bg-rose-600 hover:text-white transition-all shadow-sm">Purge All</button>
                                )}
                                <button onClick={() => window.print()} className="bg-white border-2 border-slate-200 px-6 py-3 rounded-xl text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] hover:border-indigo-600 hover:text-indigo-600 transition-all">Download PDF</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto print:overflow-visible">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-900 text-white font-black text-[9px] uppercase tracking-[0.2em]">
                                        <th className="p-4 border-r border-white/5 w-32 text-center bg-slate-950">Day Order</th>
                                        {periods.map(p => {
                                            let label = p.type;
                                            if (p.type === 'CLASS') {
                                                const classCount = periods.filter(x => x.type === 'CLASS' && x.period_number <= p.period_number).length;
                                                label = `P${classCount}`;
                                            }
                                            return (
                                                <th key={p.id} className={`p-4 border-r border-white/5 text-center ${p.is_break ? 'bg-slate-800 text-slate-400' : ''}`}>
                                                    <span className="block">{label}</span>
                                                    <span className="text-[7px] opacity-40 font-bold block tracking-normal mt-0.5">{p.start_time} - {p.end_time}</span>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => (
                                        <tr key={day} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 border-r border-b border-slate-200 bg-slate-50 font-black text-slate-900 text-[9px] text-center uppercase tracking-widest">{day}</td>
                                            {periods.map(period => {
                                                const data = period.is_break ? null : (
                                                    timetables.find(t => {
                                                        const tPeriod = periods.find(p => p.id === t.period_id);
                                                        if (!tPeriod) return false;

                                                        // Robust matching: match by ID or start_time fallback to handle registry shifts
                                                        return t.day_of_week?.toLowerCase() === day.toLowerCase() &&
                                                               (t.period_id === period.id || tPeriod.start_time === period.start_time) &&
                                                               (!selectedSemester || parseInt(t.semester_id) === parseInt(selectedSemester))
                                                    })
                                                );
                                                if (period.is_break) return (
                                                    <td key={period.id} className="p-4 border-r border-b border-slate-200 bg-slate-100/50 text-center">
                                                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em] rotate-90 inline-block py-2 opacity-30 italic">{period.type}</span>
                                                    </td>
                                                );
                                                return (
                                                    <td key={period.id} className="p-1.5 border-r border-b border-slate-100 text-center min-w-[140px] align-top bg-white">
                                                        {data ? (
                                                            <div className={`p-3 rounded-xl border-b-2 h-full flex flex-col justify-center animate-in zoom-in duration-500 shadow-sm transition-transform hover:scale-[1.02] ${getSubjectColor(data.subject_name, data.subject_type)}`}>
                                                                <p className="text-[9px] font-black leading-tight uppercase mb-1.5">{data.subject_name}</p>
                                                                <div className="h-[1px] w-5 bg-current opacity-20 mx-auto mb-1.5"></div>
                                                                <p className="text-[8px] font-bold opacity-60 uppercase truncate italic">{data.faculty_name}</p>
                                                            </div>
                                                        ) : (
                                                            <div className="py-8 opacity-5">
                                                                <p className="text-[7px] font-black uppercase">Slot Open</p>
                                                            </div>
                                                        )}
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

                {view === 'SETTINGS' && (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/40 border border-slate-200">
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center">
                                        <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mr-4 shadow-sm"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                                        Operational Hours
                                    </h2>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await API.post('/sync-registry');
                                                alert("System Registry Synchronized Successfully!");
                                                fetchData();
                                            } catch (e) { alert("Sync Failed"); }
                                        }}
                                        className="text-[9px] font-black uppercase text-indigo-600 border-2 border-indigo-600 px-4 py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                                    >
                                        Sync Registry
                                    </button>
                                </div>
                                <div className="space-y-3">
                                {periods.map(p => (
                                    <div key={p.id} className={`flex justify-between items-center p-5 rounded-[1.5rem] border transition-all ${p.is_break ? 'bg-slate-50/50 border-slate-100 italic' : 'bg-white border-slate-200 shadow-sm hover:border-indigo-300'}`}>
                                        <div className="flex items-center space-x-4">
                                            <span className="h-10 w-10 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-[10px] text-slate-500">{p.type === 'CLASS' ? `P${periods.filter(x => x.type === 'CLASS' && x.period_number <= p.period_number).length}` : 'BR'}</span>
                                            <div>
                                                <p className="font-black text-xs text-slate-800 tracking-wider">{p.start_time} - {p.end_time}</p>
                                                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{p.is_break ? 'Institutional Rest' : 'Academic Session'}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-sm ${p.is_break ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-indigo-600 text-white border border-indigo-700'}`}>{p.type}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/40 border border-slate-200">
                            <h2 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tight flex items-center">
                                <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mr-4 shadow-sm"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                                Weekly Cycle
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                {workingDays.map(day => (
                                    <div key={day.id} className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center justify-center space-y-2 shadow-sm ${day.is_working ? 'border-emerald-500 bg-emerald-50/30 text-emerald-800' : 'border-slate-100 bg-slate-50 text-slate-300'}`}>
                                        <span className="text-[10px] font-black uppercase tracking-[0.25em]">{day.day_name}</span>
                                        <div className="flex items-center space-x-2">
                                            <span className={`h-1 w-1 rounded-full ${day.is_working ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                            <span className="text-[8px] font-bold uppercase opacity-60 tracking-widest">{day.is_working ? 'Working' : 'Weekend'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8 p-6 bg-slate-900 rounded-[2rem] text-white/50 text-[9px] font-medium leading-relaxed italic border border-white/5">
                                * Institutional parameters are locked. Contact system administrator for cycle modifications or timing recalibration.
                            </div>
                        </div>
                    </div>

                    {/* STRUCTURAL REGISTRY */}
                    <div className="mt-8 bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/40 border border-slate-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center">
                                <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mr-4 shadow-sm"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg></div>
                                Structural Registry
                            </h2>
                            <button
                                onClick={async () => {
                                    try {
                                        await API.post('/seed-institution');
                                        alert("Default Institution Structure Created! (Semesters 1-8 Ready)");
                                        fetchData();
                                    } catch (e) { alert("Seed Failed: Admin authorization required."); }
                                }}
                                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                            >
                                Initialize Institution
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* DEPARTMENTS */}
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Departments</p>
                                <div className="flex gap-2">
                                    <input className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500" placeholder="e.g. CSE" value={newDept.name} onChange={e => setNewDept({ name: e.target.value })} />
                                    <button onClick={async () => { await API.post('/departments', newDept); setNewDept({ name: '' }); fetchData(); }} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></button>
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                                    {depts.map(d => <div key={d.id} className="p-3 bg-slate-50 rounded-xl text-[10px] font-black text-slate-600 uppercase flex justify-between items-center"><span>{d.name}</span> <span className="opacity-30">#{d.id}</span></div>)}
                                </div>
                            </div>

                            {/* PROGRAMS */}
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Programs</p>
                                <div className="space-y-2">
                                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" value={newProg.department_id} onChange={e => setNewProg({ ...newProg, department_id: e.target.value })}>
                                        <option value="">Select Dept...</option>
                                        {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                    <div className="flex gap-2">
                                        <input className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" placeholder="e.g. B.Tech IT" value={newProg.name} onChange={e => setNewProg({ ...newProg, name: e.target.value })} />
                                        <button onClick={async () => { await API.post('/programs', newProg); setNewProg({ name: '', type: 'UG', department_id: '' }); fetchData(); }} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></button>
                                    </div>
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                                    {programs.map(p => <div key={p.id} className="p-3 bg-slate-50 rounded-xl text-[10px] font-black text-slate-600 uppercase flex justify-between items-center"><span>{p.name}</span> <span className="opacity-30">{depts.find(d => d.id === parseInt(p.department_id))?.name}</span></div>)}
                                </div>
                            </div>

                            {/* SEMESTERS */}
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Semesters</p>
                                <div className="space-y-2">
                                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" value={newSem.program_id} onChange={e => setNewSem({ ...newSem, program_id: e.target.value })}>
                                        <option value="">Select Program...</option>
                                        {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <div className="flex gap-2">
                                        <input className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" placeholder="Sem No (1-8)" type="number" value={newSem.number} onChange={e => setNewSem({ ...newSem, number: e.target.value })} />
                                        <button onClick={async () => { await API.post('/semesters', newSem); setNewSem({ number: '', program_id: '', is_active: true }); fetchData(); }} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></button>
                                    </div>
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                                    {semesters.map(s => <div key={s.id} className="p-3 bg-slate-50 rounded-xl text-[10px] font-black text-slate-600 uppercase flex justify-between items-center"><span>Sem {s.number} - {programs.find(p => p.id === parseInt(s.program_id))?.name}</span> <span className={s.number % 2 !== 0 ? "text-indigo-500" : "text-emerald-500"}>{s.number % 2 !== 0 ? 'ODD' : 'EVEN'}</span></div>)}
                                </div>
                            </div>
                        </div>
                    </div>
                    </>
                )}
            </main>

            {/* MODALS */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col border border-white/20 max-h-[95vh]">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
                            <h2 className="text-lg font-black uppercase tracking-[0.2em]">
                                {modalType === 'SUBJECT' ? (editingSubject ? 'Edit Subject Registry' : 'New Curriculum Registry') : `Allocating ${selectedFaculty?.name}`}
                            </h2>
                            <button onClick={() => { setShowModal(false); setEditingSubject(null); setNewSubject({ name: '', code: '', type: 'Theory', credits: 3, weekly_hours: 3, semester_id: '', department_id: '' }); }} className="p-2 hover:bg-white/10 rounded-full transition-colors"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>

                        <div className="overflow-y-auto p-10 custom-scrollbar">
                            {modalType === 'SUBJECT' ? (
                                <form onSubmit={handleAddSubject} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Unique Code</label><input className="w-full p-4 bg-slate-50 rounded-xl font-black text-slate-700 outline-none border-2 border-slate-200 focus:border-indigo-500 text-sm" value={newSubject.code} onChange={e => setNewSubject({...newSubject, code: e.target.value})} required/></div>
                                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Subject Name</label><input className="w-full p-4 bg-slate-50 rounded-xl font-black text-slate-700 outline-none border-2 border-slate-200 focus:border-indigo-500 text-sm" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} required/></div>
                                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Classification</label><select className="w-full p-4 bg-slate-50 rounded-xl font-black text-slate-700 outline-none border-2 border-slate-200 text-sm" value={newSubject.type} onChange={e => setNewSubject({...newSubject, type: e.target.value})}><option value="Theory">Theory Lecture</option><option value="Practical">Practical / Lab</option></select></div>
                                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Semester</label><select className="w-full p-4 bg-slate-50 rounded-xl font-black text-slate-700 outline-none border-2 border-slate-200 text-sm" value={newSubject.semester_id} onChange={e => setNewSubject({...newSubject, semester_id: e.target.value})} required><option value="">Select...</option>{semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number} ({s.number % 2 !== 0 ? 'Odd' : 'Even'})</option>)}</select></div>
                                    <div className="md:col-span-2 flex gap-4 mt-6 pt-6 border-t border-slate-100">
                                        <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 border-2 border-slate-200 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
                                        <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100">Save</button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleAssignFaculty} className="space-y-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Target Subject (Curriculum mapping)</label>
                                        <select
                                            className="w-full p-4 bg-slate-50 rounded-xl font-black text-slate-700 outline-none border-2 border-slate-200 text-sm focus:border-indigo-500"
                                            value={newAssignment.subject_id}
                                            onChange={e => handleSubjectSelect(e.target.value)}
                                            required
                                        >
                                            <option value="">Select from Subject Module...</option>
                                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name} [{s.code}] - Sem {s.semester_id}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5 opacity-60">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Auto-set Semester</label>
                                        <div className="w-full p-4 bg-slate-100 rounded-xl font-black text-slate-500 border border-slate-200 text-sm">
                                            {newAssignment.semester_id ? `Assigned to Semester ${newAssignment.semester_id}` : 'Select subject to auto-map'}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Academic Section</label>
                                        <select className="w-full p-4 bg-slate-50 rounded-xl font-black text-slate-700 outline-none border-2 border-slate-200 text-sm" value={newAssignment.section} onChange={e => setNewAssignment({...newAssignment, section: e.target.value})}>
                                            <option value="">Section A (Default)</option>
                                            {['B', 'C', 'D'].map(s => <option key={s} value={s}>Section {s}</option>)}
                                        </select>
                                    </div>
                                    <div className="pt-8 flex gap-4">
                                        <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 border-2 border-slate-200 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest">Discard</button>
                                        <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100">Confirm Allocation</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimetableManager;
