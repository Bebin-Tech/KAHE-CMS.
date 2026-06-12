import React, { useEffect, useState } from 'react';
import API from '../api';

const TimetableManagement = () => {
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [workingDays, setWorkingDays] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [activeTab, setActiveTab] = useState('dashboard');

    const [showSubModal, setShowSubModal] = useState(false);
    const [newSubject, setNewSubject] = useState({ name: '', code: '', type: 'Theory', credits: 3, weekly_hours: 3, semester_id: '', department_id: '' });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [statsRes, deptRes, progRes, semRes, subRes, wdRes, ptRes] = await Promise.all([
                API.get('/dashboard-stats'),
                API.get('/departments'),
                API.get('/programs'),
                API.get('/semesters'),
                API.get('/subjects'),
                API.get('/working-days'),
                API.get('/period-timings')
            ]);
            setStats(statsRes.data);
            setDepartments(deptRes.data);
            setPrograms(progRes.data);
            setSemesters(semRes.data);
            setSubjects(subRes.data);
            setWorkingDays(wdRes.data);
            setPeriods(ptRes.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleAddSubject = async (e) => {
        if (e) e.preventDefault();
        try {
            await API.post('/subjects', newSubject);
            setShowSubModal(false);
            fetchInitialData();
            alert("Subject Added Successfully");
        } catch (err) {
            alert(err.response?.data?.detail || "Operation failed");
        }
    };

    const handleGenerate = async (semesterId) => {
        if (!semesterId) return alert("Select a semester first");
        try {
            const res = await API.post(`/generate-timetable?semester_id=${semesterId}`);
            alert(res.data.message);
            fetchInitialData();
        } catch (err) {
            alert(err.response?.data?.detail || "Generation failed");
        }
    };

    if (loading) return <div className="p-10 text-center font-bold animate-pulse">Loading Timetable Module...</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-screen">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Timetable Module</h1>
                    <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-xs">Academic Control & Automation</p>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="flex space-x-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                {['dashboard', 'subjects', 'academic settings', 'generator'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                            activeTab === tab
                            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100'
                            : 'bg-white text-gray-400 border border-gray-100 hover:bg-gray-50'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {[
                        { label: 'Departments', value: stats.total_departments, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
                        { label: 'Programs', value: stats.total_programs, icon: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.052 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z' },
                        { label: 'Semesters', value: stats.total_semesters, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                        { label: 'Subjects', value: stats.total_subjects, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                        { label: 'Faculties', value: stats.total_faculties, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857' },
                        { label: 'Classrooms', value: stats.total_classrooms, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
                        { label: 'Approved', value: stats.approved_timetables, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { label: 'Conflicts', value: stats.conflict_alerts, icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-red-500' }
                    ].map((item, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50 flex flex-col items-center group hover:shadow-xl transition-all duration-500">
                            <div className={`p-4 rounded-2xl mb-4 bg-gray-50 text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-500`}>
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                            </div>
                            <p className={`text-4xl font-black ${item.color || 'text-gray-900'}`}>{item.value}</p>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{item.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'subjects' && (
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-8 flex justify-between items-center border-b border-gray-50">
                        <h2 className="text-xl font-black text-gray-800">Subject Directory</h2>
                        <button
                            onClick={() => setShowSubModal(true)}
                            className="px-6 py-2.5 border-2 border-indigo-600 text-indigo-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-50 transition"
                        >
                            + Add New Subject
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <th className="p-6">Code</th>
                                    <th className="p-6">Subject Name</th>
                                    <th className="p-6">Category</th>
                                    <th className="p-6">Semester</th>
                                    <th className="p-6 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjects.map(s => (
                                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                        <td className="p-6"><span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-black text-slate-700">{s.code}</span></td>
                                        <td className="p-6 font-bold text-gray-700">{s.name}</td>
                                        <td className="p-6">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${s.type === 'Lab' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100'}`}>{s.type}</span>
                                        </td>
                                        <td className="p-6 text-gray-500 font-bold">SEM {semesters.find(sem => sem.id === s.semester_id)?.number || s.semester_id}</td>
                                        <td className="p-6 text-center">
                                            <button className="text-indigo-600 font-bold text-xs mr-4 hover:underline">Edit</button>
                                            <button className="text-red-500 font-bold text-xs hover:underline">Remove</button>
                                        </td>
                                    </tr>
                                ))}
                                {subjects.length === 0 && <tr><td colSpan="5" className="p-20 text-center text-gray-400 italic">No subjects registered yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'academic settings' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                        <h2 className="text-xl font-black text-gray-800 mb-6 uppercase tracking-tight">Working Configuration</h2>
                        <div className="space-y-6">
                            <div className="flex flex-wrap gap-3">
                                {workingDays.map(day => (
                                    <div key={day.id} className={`px-4 py-3 rounded-2xl border-2 transition-all cursor-pointer ${day.is_working ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
                                        <p className="text-xs font-black uppercase tracking-widest">{day.day_name}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-6 border-t border-gray-50">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Period Timings</p>
                                <div className="space-y-3">
                                    {periods.map(p => (
                                        <div key={p.id} className={`flex justify-between items-center p-4 rounded-2xl ${p.is_break ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}`}>
                                            <span className="font-black text-xs text-gray-700">PERIOD {p.period_number}</span>
                                            <span className="font-bold text-xs text-gray-500">{p.start_time} - {p.end_time}</span>
                                            {p.is_break && <span className="text-[8px] font-black bg-amber-200 text-amber-800 px-2 py-0.5 rounded uppercase">Break</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                        <h2 className="text-xl font-black text-gray-800 mb-6 uppercase tracking-tight">Active Academic Year</h2>
                        <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100">
                            <p className="text-4xl font-black text-indigo-700">2023 - 2024</p>
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">Status: Odd Semester Active</p>
                        </div>
                        <button className="w-full mt-6 py-4 border-2 border-gray-200 text-gray-400 rounded-2xl font-bold uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition">Update Academic Settings</button>
                    </div>
                </div>
            )}

            {activeTab === 'generator' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                        <h2 className="text-xl font-black text-gray-800 mb-6 uppercase tracking-tight">Automatic Generator</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Academic Program</label>
                                <select className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 outline-none appearance-none">
                                    <option>Select Program...</option>
                                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Target Semester</label>
                                <select className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 outline-none appearance-none">
                                    <option>Select Semester...</option>
                                    {semesters.map(s => <option key={s.id} value={s.id}>Semester {s.number}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="mt-8 flex gap-4">
                            <button
                                onClick={() => handleGenerate(semesters[0]?.id)}
                                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition transform active:scale-95"
                            >
                                Run Auto-Generator
                            </button>
                            <button className="px-8 py-4 border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition">Preview</button>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                        <h2 className="text-xl font-black text-gray-800 mb-6 uppercase tracking-tight">Export Center</h2>
                        <div className="space-y-4">
                            <button className="w-full p-6 border-2 border-gray-50 rounded-3xl flex items-center space-x-4 hover:border-indigo-600 transition group">
                                <div className="h-12 w-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors"><p className="font-black text-xs">PDF</p></div>
                                <div className="text-left"><p className="font-black text-gray-800 uppercase tracking-tighter">Export Department-wise</p><p className="text-[10px] text-gray-400 font-bold uppercase">Ready for print</p></div>
                            </button>
                            <button className="w-full p-6 border-2 border-gray-50 rounded-3xl flex items-center space-x-4 hover:border-indigo-600 transition group">
                                <div className="h-12 w-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-500 group-hover:bg-green-500 group-hover:text-white transition-colors"><p className="font-black text-xs">XLS</p></div>
                                <div className="text-left"><p className="font-black text-gray-800 uppercase tracking-tighter">Export Semester-wise</p><p className="text-[10px] text-gray-400 font-bold uppercase">Excel Datasheet</p></div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Add Subject */}
            {showSubModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 p-8 text-white"><h2 className="text-2xl font-black uppercase tracking-tight">Add New Subject</h2></div>
                        <form onSubmit={handleAddSubject} className="p-10 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Subject Code</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={newSubject.code} onChange={e => setNewSubject({...newSubject, code: e.target.value})} required placeholder="e.g. CS101"/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Subject Name</label><input className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} required placeholder="e.g. Operating Systems"/></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Department</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none" value={newSubject.department_id} onChange={e => setNewSubject({...newSubject, department_id: e.target.value})} required><option value="">Select Dept</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Semester</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none" value={newSubject.semester_id} onChange={e => setNewSubject({...newSubject, semester_id: e.target.value})} required><option value="">Select Sem</option>{semesters.map(s => <option key={s.id} value={s.id}>Sem {s.number}</option>)}</select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Type</label><select className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none" value={newSubject.type} onChange={e => setNewSubject({...newSubject, type: e.target.value})} required><option value="Theory">Theory</option><option value="Lab">Lab</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase ml-1">Credits</label><input type="number" className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition" value={newSubject.credits} onChange={e => setNewSubject({...newSubject, credits: e.target.value})} required/></div>
                            <div className="p-2 md:col-span-2 border-t border-gray-50 flex gap-4 mt-4">
                                <button type="button" onClick={() => setShowSubModal(false)} className="flex-1 py-4 border-2 border-gray-100 text-gray-400 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-50 transition">Cancel</button>
                                <button type="submit" className="flex-1 py-4 border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition">Register Subject</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimetableManagement;
