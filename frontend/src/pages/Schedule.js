import React, { useEffect, useState } from 'react';
import API from '../api';

const Schedule = () => {
    const [timetables, setTimetables] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const role = localStorage.getItem('role')?.toLowerCase();
                const facultyId = localStorage.getItem('user_id');

                let ttUrl = '/timetables';
                // If faculty, we show their specific timetable by default
                if (role === 'faculty') {
                    ttUrl = `/faculty-timetable/${facultyId}`;
                }

                const [ttRes, periodsRes] = await Promise.all([
                    API.get(ttUrl),
                    API.get('/period-timings')
                ]);
                setTimetables(ttRes.data || []);
                const sortedPeriods = (periodsRes.data || []).sort((a, b) => {
                    const toMin = (t) => {
                        let [h, m] = (t || "00:00").split(':').map(Number);
                        if (h < 8) h += 12;
                        return h * 60 + m;
                    };
                    return toMin(a.start_time) - toMin(b.start_time);
                });
                setPeriods(sortedPeriods);
                setLoading(false);
            } catch (err) {
                console.error("Schedule fetch error:", err);
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleDownloadPDF = async () => {
        try {
            const role = localStorage.getItem('role')?.toLowerCase();
            const url = role === 'faculty'
                ? `/timetables/pdf/faculty/${localStorage.getItem('user_id')}`
                : `/timetables/pdf/semester/1`; // Default or first sem for general view

            const response = await API.get(url, { responseType: 'blob' });
            const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'Institutional_Timetable.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert("Download Failed: Engine not ready.");
        }
    };

    const getScheduleForCell = (day, periodId) => {
        return timetables.find(t => t.day_of_week === day && t.period_id === periodId);
    };

    if (loading) return <div className="p-4 sm:p-10 text-center font-bold text-gray-400 animate-pulse uppercase tracking-widest">Synchronizing Academic Schedule...</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-screen">
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Academic Timetable</h1>
                    <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Karpagam Academy of Higher Education • Official Schedule</p>
                </div>
                <button
                    onClick={handleDownloadPDF}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                >
                    Download PDF
                </button>
            </header>

            <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-[#1e1b4b] text-white">
                                <th className="p-6 border border-white/5 w-44 font-black text-[10px] uppercase tracking-widest">Day \ Period</th>
                                {periods.map(p => {
                                    // P1, P2, INTERVAL, P3, P4, LUNCH, P5, P6
                                    let label = p.type;
                                    if (p.type === 'CLASS') {
                                        const classCount = periods.filter(x => x.type === 'CLASS' && x.period_number <= p.period_number).length;
                                        label = `P${classCount}`;
                                    }
                                    return (
                                        <th key={p.id} className={`p-6 border border-white/5 text-center ${p.is_break ? 'bg-indigo-900/40 text-indigo-200' : ''}`}>
                                            <span className="block font-black text-[10px] uppercase tracking-wider">{label}</span>
                                            <span className="text-[8px] opacity-60 font-bold mt-1 block">{p.start_time} - {p.end_time}</span>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {days.map(day => (
                                <tr key={day} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-6 border border-gray-100 bg-gray-50/40 font-black text-gray-900 text-xs text-center uppercase tracking-tighter">{day}</td>
                                    {periods.map(period => {
                                        const item = period.is_break ? null : getScheduleForCell(day, period.id);

                                        if (period.is_break) return (
                                            <td key={period.id} className="p-6 border border-gray-100 bg-gray-100/20 text-center">
                                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.4em] rotate-90 inline-block py-2">{period.type}</span>
                                            </td>
                                        );

                                        if (!item) return <td key={period.id} className="p-4 border border-gray-100 text-center text-[8px] font-bold text-gray-200 uppercase">Unallocated</td>;

                                        const n = item.subject_name?.toLowerCase() || '';
                                        const t = item.subject_type?.toLowerCase() || '';
                                        const colorClass = (n.includes('practical') || n.includes('lab') || t.includes('practical'))
                                            ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                                            : (n.includes('community engagement') || n.includes('social responsibility') ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-green-50 border-green-200 text-green-800');

                                        return (
                                            <td key={period.id} className="p-2 border border-gray-100 text-center min-w-[160px] align-top">
                                                <div className={`p-4 rounded-2xl border-b-2 h-full flex flex-col justify-center transition-transform hover:scale-95 ${colorClass}`}>
                                                    <p className="font-black text-[10px] leading-tight uppercase mb-1">{item.subject_name}</p>
                                                    <div className="h-px w-6 bg-current opacity-10 mx-auto my-1.5"></div>
                                                    <p className="text-[9px] font-bold opacity-70 uppercase truncate">{item.faculty_name}</p>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-6">
                <div className="flex items-center space-x-3">
                    <div className="h-4 w-4 rounded-lg bg-green-50 border border-green-200"></div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Theory Lecture</span>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="h-4 w-4 rounded-lg bg-yellow-50 border border-yellow-200"></div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Practical / Laboratory</span>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="h-4 w-4 rounded-lg bg-blue-50 border border-blue-200"></div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Other Subjects</span>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="h-4 w-4 rounded-lg bg-gray-100/30 border border-gray-100"></div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Institutional Break</span>
                </div>
            </div>
        </div>
    );
};

export default Schedule;
