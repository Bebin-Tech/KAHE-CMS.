import React, { useEffect, useState } from 'react';
import API from '../api';

const TimetableManagement = () => {
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [faculties, setFaculties] = useState([]);
    const [workingDays, setWorkingDays] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [timetables, setTimetables] = useState([]);

    const [activeTab, setActiveTab] = useState('dashboard');
    const [showSubModal, setShowSubModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);

    const [newSubject, setNewSubject] = useState({ name: '', code: '', type: 'Theory', credits: 3, weekly_hours: 3, semester_id: '', department_id: '' });
    const [selectedFaculty, setSelectedFaculty] = useState(null);
    const [newAssignment, setNewAssignment] = useState({ subject_id: '', semester_id: '' });

    const [selectedSemester, setSelectedSemester] = useState('');
    const [approvalComments, setApprovalComments] = useState('');
    const [selectedSlot, setSelectedSlot] = useState(null);

    const fetchInitialData = async () => {
        try {
            const [statsRes, deptRes, progRes, semRes, subRes, wdRes, ptRes, userRes] = await Promise.all([
                API.get('/dashboard-stats'),
                API.get('/departments'),
                API.get('/programs'),
                API.get('/semesters'),
                API.get('/subjects'),
                API.get('/working-days'),
                API.get('/period-timings'),
                API.get('/users_list')
            ]);
            setStats(statsRes.data || {});
            setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
            setPrograms(Array.isArray(progRes.data) ? progRes.data : []);
            setSemesters(Array.isArray(semRes.data) ? semRes.data : []);
            setSubjects(Array.isArray(subRes.data) ? subRes.data : []);
            setWorkingDays(Array.isArray(wdRes.data) ? wdRes.data : []);
            setPeriods(Array.isArray(ptRes.data) ? ptRes.data : []);
            setFaculties(Array.isArray(userRes.data) ? userRes.data.filter(u => u.role === 'faculty') : []);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    const handleGenerate = async (params = {}) => {
        try {
            const queryParams = new URLSearchParams(params).toString();
            const res = await API.post(`/generate-timetable?${queryParams}`);
            alert(res.data.message);
            fetchInitialData();
        } catch (err) {
            alert(err.response?.data?.detail || "Generation failed");
        }
    };

    const fetchTimetable = async (semId) => {
        if (!semId) return;
        try {
            const res = await API.get(`/timetables?semester_id=${semId}`);
            setTimetables(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAssignFaculty = async (e) => {
        if (e) e.preventDefault();
        try {
            await API.post('/faculty-assignments', {
                faculty_id: selectedFaculty?.id,
                subject_id: parseInt(newAssignment.subject_id),
                semester_id: parseInt(newAssignment.semester_id)
            });
            setShowAssignModal(false);
            alert("Faculty Assigned Successfully");
            fetchInitialData();
        } catch (err) {
            alert("Assignment failed");
        }
    };

    const updateStatus = async (semId, status) => {
        try {
            await API.post(`/timetable-approval?semester_id=${semId}&status=${status}&comments=${approvalComments}`);
            alert(`Timetable ${status}`);
            fetchTimetable(semId);
            fetchInitialData();
        } catch (err) {
            alert("Approval update failed");
        }
    };

    const handleSlotSwap = async (targetSlot) => {
        if (!selectedSlot) {
            setSelectedSlot(targetSlot);
            return;
        }
        if (selectedSlot.id === targetSlot.id) {
            setSelectedSlot(null);
            return;
        }
        try {
            await API.post(`/swap-slots?tt1_id=${selectedSlot.id}&tt2_id=${targetSlot.id}`);
            setSelectedSlot(null);
            fetchTimetable(selectedSemester);
            alert("Slots Swapped Successfully");
        } catch (err) {
            alert("Swap failed");
            setSelectedSlot(null);
        }
    };

    const handleAddSubject = async (e) => {
        if (e) e.preventDefault();
        try {
            await API.post('/subjects', newSubject);
            setShowSubModal(false);
            setNewSubject({ name: '', code: '', type: 'Theory', credits: 3, weekly_hours: 3, semester_id: '', department_id: '' });
            fetchInitialData();
        } catch (err) {
            alert("Error adding subject");
        }
    };

    if (loading) return <div className="p-10 text-center font-black text-gray-400 animate-pulse uppercase tracking-[0.3em]">Establishing Academic Framework...</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-screen">
            <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Timetable Module</h1>
                    <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Administrative Academic Control</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button className="px-6 py-3 border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition">Export PDF</button>
                    <button onClick={() => handleGenerate()} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-100">Batch Generate</button>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="flex space-x-2 mb-10 overflow-x-auto pb-2 scrollbar-hide border-b border-gray-100">
                {['dashboard', 'subjects', 'faculty allocation', 'generator', 'approval', 'view matrix', 'academic settings'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 rounded-t-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                            activeTab === tab
                            ? 'bg-white border-x border-t border-gray-100 text-indigo-600 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
                    {[
                        { label: 'Departments', value: stats.total_departments, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5' },
                        { label: 'Total Semesters', value: stats.total_semesters, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7' },
                        { label: 'Approved Maps', value: stats.approved_timetables, icon: 'M9 12l2 2 4-4' },
                        { label: 'Active Conflicts', value: stats.conflict_alerts, icon: 'M12 8v4m0 4h.01', color: 'text-red-500' }
                    ].map((item, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center group hover:shadow-xl transition-all duration-500">
                            <div className="p-4 rounded-2xl mb-4 bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                            </div>
                            <p className={`text-4xl font-black ${item.color || 'text-gray-900'}`}>{item.value}</p>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{item.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* APPROVAL WORKFLOW */}
            {activeTab === 'approval' && (
                <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm animate-in fade-in duration-500">
                    <h2 className="text-2xl font-black text-gray-900 mb-8 uppercase tracking-tight">Approval Center</h2>
                    <div className="space-y-4">
                        {semesters.map(sem => (
                            <div key={sem.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6">
                                <div className="text-center sm:text-left">
                                    <p className="font-black text-lg text-gray-800 uppercase leading-none">Sem {sem.number} - {programs.find(p => p.id === sem.program_id)?.name}</p>
                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-2 inline-block px-3 py-1 bg-amber-50 rounded-full border border-amber-100">Status: Pending Verification</span>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={() => { setSelectedSemester(sem.id); fetchTimetable(sem.id); setActiveTab('view matrix'); }} className="px-6 py-3 border-2 border-gray-200 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition">Inspect Draft</button>
                                    <button onClick={() => updateStatus(sem.id, 'APPROVED')} className="px-6 py-3 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition shadow-lg shadow-green-100">Approve Matrix</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ACADEMIC SETTINGS */}
            {activeTab === 'academic settings' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
                    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-black text-gray-900 mb-8 uppercase tracking-tight">Operational Hours</h2>
                        <div className="space-y-4">
                            {periods.map(p => (
                                <div key={p.id} className={`flex justify-between items-center p-5 rounded-2xl ${p.is_break ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50 border border-gray-100'}`}>
                                    <div className="flex items-center space-x-4">
                                        <span className="h-10 w-10 bg-white rounded-xl flex items-center justify-center font-black text-xs text-gray-400">P{p.period_number}</span>
                                        <span className="font-black text-sm text-gray-700">{p.start_time} - {p.end_time}</span>
                                    </div>
                                    <span className={`text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-[0.1em] ${p.is_break ? 'bg-amber-200 text-amber-800' : 'bg-indigo-100 text-indigo-600'}`}>{p.type}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
                        <h2 className="text-2xl font-black text-gray-900 mb-8 uppercase tracking-tight">Weekly Cycle</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {workingDays.map(day => (
                                <div key={day.id} className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center justify-center space-y-2 ${day.is_working ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 bg-gray-50 text-gray-300'}`}>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{day.day_name}</span>
                                    <span className="text-[8px] font-bold uppercase opacity-60">{day.is_working ? 'Working' : 'Weekend'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* SUBJECTS */}
            {activeTab === 'subjects' && (
                <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
                    <div className="p-8 flex justify-between items-center border-b border-gray-50">
                        <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Core Curriculum</h2>
                        <button onClick={() => setShowSubModal(true)} className="px-6 py-2.5 border-2 border-indigo-600 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition">+ Register Subject</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                <tr><th className="p-8">Code</th><th className="p-8">Description</th><th className="p-8">Mapping</th><th className="p-8 text-center">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {subjects.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50/50 transition group">
                                        <td className="p-8"><span className="bg-white px-4 py-1.5 rounded-xl border border-gray-200 text-xs font-black text-gray-700 shadow-sm">{s.code}</span></td>
                                        <td className="p-8"><p className="font-black text-gray-800 uppercase text-sm leading-none">{s.name}</p><p className="text-[10px] text-gray-400 font-bold mt-2 tracking-widest uppercase">{s.type} • {s.weekly_hours}h per week</p></td>
                                        <td className="p-8"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">Sem {s.semester_id}</span></td>
                                        <td className="p-8 text-center"><button className="text-red-300 hover:text-red-500 transition font-black text-[10px] uppercase tracking-widest">Retire</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* GENERATOR */}
            {activeTab === 'generator' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
                    <div className="lg:col-span-2 bg-white p-12 rounded-[3.5rem] shadow-sm border border-gray-100">
                        <h2 className="text-3xl font-black text-gray-900 mb-10 uppercase tracking-tight">Intelligent Engine</h2>
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Target Semester</label>
                                    <select className="w-full p-5 bg-gray-50 border-none rounded-[1.5rem] font-black text-gray-700 outline-none appearance-none" value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}>
                                        <option value="">Select Semester Matrix...</option>
                                        {semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number} - {programs.find(p => p.id === s.program_id)?.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Academic Year</label>
                                    <div className="w-full p-5 bg-indigo-50 text-indigo-600 rounded-[1.5rem] font-black text-sm uppercase">2023 - 2024</div>
                                </div>
                            </div>
                            <div className="pt-6 border-t border-gray-50 flex gap-4">
                                <button onClick={() => handleGenerate({ semester_id: selectedSemester })} className="flex-1 py-5 bg-white border-2 border-indigo-600 text-indigo-600 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition shadow-sm">Generate Matrix</button>
                                <button onClick={() => handleGenerate()} className="flex-[2] py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition active:scale-95">Execute Full Institutional Batch</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW MATRIX */}
            {activeTab === 'view matrix' && (
                <div className="space-y-10 animate-in fade-in duration-500">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 flex flex-wrap gap-4 items-end shadow-sm">
                        <div className="flex-1 min-w-[200px] space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Matrix Selection</label>
                            <select className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold outline-none" onChange={(e) => { setSelectedSemester(e.target.value); fetchTimetable(e.target.value); }}>
                                <option value="">Choose View...</option>
                                {semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number} - {programs.find(p => p.id === s.program_id)?.name}</option>)}
                            </select>
                        </div>
                        <button onClick={() => fetchTimetable(selectedSemester)} className="px-8 py-4 border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest">Synchronize</button>
                    </div>
                    {selectedSemester && (
                        <div className="bg-white rounded-[3rem] border border-gray-100 overflow-hidden shadow-sm relative">
                            {selectedSlot && <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-8 py-2.5 rounded-full font-black text-[10px] uppercase tracking-[0.2em] animate-bounce z-20 shadow-2xl">Swap Mode: Choose Destination Slot</div>}
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                                            <th className="p-8 border-r border-white/10 text-left">Period \ Day</th>
                                            {periods.map(p => <th key={p.id} className="p-8 border-r border-white/10 text-center">{p.period_number}<br/><span className="text-[7px] opacity-60 font-bold">{p.start_time}-{p.end_time}</span></th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {workingDays.filter(d => d.is_working).map(day => (
                                            <tr key={day.id}>
                                                <td className="p-8 bg-gray-50 font-black text-gray-900 text-[11px] uppercase border-r border-gray-100">{day.day_name}</td>
                                                {periods.map(period => {
                                                    const slot = timetables.find(t => t.day_of_week === day.day_name && t.period_id === period.id);
                                                    const isSelected = selectedSlot?.id === slot?.id;
                                                    return (
                                                        <td key={period.id} className={`p-4 border-r border-gray-50 text-center min-w-[200px] cursor-pointer transition-all ${period.is_break ? 'bg-amber-50/20' : 'hover:bg-gray-50'}`} onClick={() => !period.is_break && slot && handleSlotSwap(slot)}>
                                                            {period.is_break ? (
                                                                <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">{period.type}</span>
                                                            ) : slot ? (
                                                                <div className={`p-5 rounded-[2rem] border transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white scale-95 shadow-2xl' : 'bg-indigo-50/30 border-indigo-100 text-indigo-700 hover:shadow-lg'}`}>
                                                                    <p className={`text-[11px] font-black leading-tight uppercase ${isSelected ? 'text-white' : 'text-indigo-900'}`}>{slot.subject?.name}</p>
                                                                    <p className={`text-[9px] font-bold mt-2 uppercase ${isSelected ? 'text-indigo-100' : 'text-gray-400'}`}>{slot.faculty?.name}</p>
                                                                    <p className={`text-[9px] font-black mt-1 ${isSelected ? 'text-white' : 'text-indigo-500'}`}>ROOM {slot.room?.room_number}</p>
                                                                </div>
                                                            ) : <span className="text-[9px] text-gray-200 font-bold uppercase tracking-widest">Available</span>}
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
            )}

            {/* MODAL: Assign Faculty */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-indigo-600 p-8 text-white"><h2 className="text-xl font-black uppercase tracking-tight">Allocating {selectedFaculty?.name}</h2></div>
                        <form onSubmit={handleAssignFaculty} className="p-10 space-y-6">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Target Semester</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={newAssignment.semester_id} onChange={e => setNewAssignment({...newAssignment, semester_id: e.target.value})} required><option value="">Select Sem...</option>{semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number} - {programs.find(p => p.id === s.program_id)?.name}</option>)}</select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Map Subject</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={newAssignment.subject_id} onChange={e => setNewAssignment({...newAssignment, subject_id: e.target.value})} required><option value="">Choose Subject...</option>{subjects.filter(s => s.semester_id === parseInt(newAssignment.semester_id)).map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</select></div>
                            <div className="pt-4 flex gap-4"><button type="button" onClick={() => setShowAssignModal(false)} className="flex-1 py-4 border-2 border-gray-100 text-gray-400 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-50 transition">Cancel</button><button type="submit" className="flex-1 py-4 border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition">Confirm Map</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Add Subject */}
            {showSubModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 p-8 text-white"><h2 className="text-2xl font-black uppercase tracking-tight">Register New Curriculum</h2></div>
                        <form onSubmit={handleAddSubject} className="p-10 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Code</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={newSubject.code} onChange={e => setNewSubject({...newSubject, code: e.target.value})} required/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Name</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} required/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Department</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={newSubject.department_id} onChange={e => setNewSubject({...newSubject, department_id: e.target.value})} required><option value="">Select Dept</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Semester</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" value={newSubject.semester_id} onChange={e => setNewSubject({...newSubject, semester_id: e.target.value})} required><option value="">Select Sem</option>{semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number}</option>)}</select></div>
                            <div className="p-2 md:col-span-2 border-t border-gray-50 flex gap-4 mt-4"><button type="button" onClick={() => setShowSubModal(false)} className="flex-1 py-4 border-2 border-gray-100 text-gray-400 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-50 transition">Cancel</button><button type="submit" className="flex-1 py-4 border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition">Save Entry</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimetableManagement;
