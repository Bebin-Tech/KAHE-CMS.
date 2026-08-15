import React, { useCallback, useEffect, useState } from 'react';
import API from '../../api';
import { Calendar, CheckCircle, RefreshCw } from 'lucide-react';
import { formatISTDateTime } from '../../timeUtils';

const StatCard = ({ label, value }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <p className="mt-3 text-3xl font-black text-slate-950">{value ?? 0}</p>
    </div>
);

const Automation = () => {
    const [status, setStatus] = useState(null);
    const [insights, setInsights] = useState(null);
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const getApiError = (err, fallback) => {
        const data = err.response?.data;
        if (!data) return fallback;
        if (typeof data === 'string') return data;
        if (data.detail) return data.detail;
        const first = Object.values(data)[0];
        return Array.isArray(first) ? first.join(', ') : String(first || fallback);
    };

    const fetchStatus = useCallback(async () => {
        setLoading(true);
        try {
            const [statusRes, runRes] = await Promise.all([
                API.get('/automation/status/'),
                API.get('/automation-runs/')
            ]);
            setStatus(statusRes.data || {});
            setRuns(Array.isArray(runRes.data) ? runRes.data : []);
            API.get('/automation/ai-insights/')
                .then(res => setInsights(res.data || null))
                .catch(() => setInsights(null));
        } catch (err) {
            setMessage({ text: getApiError(err, 'Automation status sync failed.'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleGenerate = async () => {
        if (!window.confirm('Generate automated classroom allocation and timetable notifications now?')) return;
        setGenerating(true);
        setMessage({ text: '', type: '' });
        try {
            const res = await API.post('/automation/generate-schedule/', {
                scope: 'weekly',
                replace_existing: true
            });
            setMessage({
                text: `Automation completed: ${res.data.generated_timetables} timetable entries and ${res.data.generated_notifications} notifications created.`,
                type: res.data.status === 'Completed' ? 'success' : 'warning'
            });
            await fetchStatus();
        } catch (err) {
            setMessage({ text: getApiError(err, 'Automation failed.'), type: 'error' });
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 bg-slate-50 space-y-7">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tightest uppercase italic">
                        Academic <span className="text-indigo-600">Automation</span>
                    </h1>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                        Configure departments, sections, subjects, faculty mappings, and rooms once. The system assigns rooms, generates timetables, and sends notifications automatically.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={fetchStatus}
                        className="px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 font-black text-[10px] uppercase tracking-widest inline-flex items-center justify-center gap-2 shadow-sm"
                    >
                        <RefreshCw size={15} />
                        Refresh
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-60"
                    >
                        {generating ? <RefreshCw className="animate-spin" size={15} /> : <Calendar size={15} />}
                        Generate Schedule
                    </button>
                </div>
            </header>

            {message.text && (
                <div className={`rounded-2xl border p-4 text-xs font-black uppercase tracking-widest ${
                    message.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : message.type === 'warning'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}>
                    {message.text}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center min-h-[45vh] text-indigo-600">
                    <RefreshCw className="animate-spin" size={32} />
                </div>
            ) : (
                <>
                    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="Active Sections" value={status?.sections} />
                        <StatCard label="Faculty Mappings" value={status?.faculty_assignments} />
                        <StatCard label="Home Rooms" value={status?.home_rooms} />
                        <StatCard label="Timetable Rows" value={status?.timetable_entries} />
                    </section>

                    <section className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-black uppercase text-slate-900">Automation Logic</h2>
                            <div className="mt-5 space-y-4 text-sm font-semibold text-slate-600">
                                <p><strong className="text-slate-900">Permanent room:</strong> each section receives a home classroom based on room capacity and current room load.</p>
                                <p><strong className="text-slate-900">CSP checks:</strong> section, faculty, room, period, room type, capacity, and availability conflicts are filtered first.</p>
                                <p><strong className="text-slate-900">GA scoring:</strong> valid rooms are ranked by permanent-room fit, capacity fit, lab/classroom match, and balanced usage.</p>
                                <p><strong className="text-slate-900">Notifications:</strong> faculty and mapped students receive classroom, subject, day, period, and time details automatically.</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-200 bg-slate-100/70">
                                <h2 className="text-lg font-black uppercase text-slate-900">Recent Automation Runs</h2>
                            </div>
                            {runs.length === 0 ? (
                                <div className="p-12 text-center">
                                    <CheckCircle className="mx-auto text-slate-500 mb-3" size={36} />
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-600">No automation runs yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-200">
                                    {runs.slice(0, 8).map(run => (
                                        <div key={run.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-black text-slate-900">{run.status} - {run.scope}</p>
                                                <p className="mt-1 text-xs font-bold text-slate-600">{formatISTDateTime(run.created_at)} IST</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="rounded-xl bg-indigo-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-700 border border-indigo-100">
                                                    {run.generated_timetables} timetable rows
                                                </span>
                                                <span className="rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 border border-emerald-100">
                                                    {run.generated_notifications} notifications
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-200 bg-slate-100/70 flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-black uppercase text-slate-900">AI / ML Engine</h2>
                                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                        CSP + GA + historical prediction + reward scoring
                                    </p>
                                </div>
                                <span className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-2 text-sm font-black text-indigo-700">
                                    {insights?.readiness_score ?? 0}% Ready
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
                                {(insights?.algorithm_stack || []).map(item => (
                                    <div key={item.name} className="rounded-2xl border border-slate-200 p-5 bg-white">
                                        <h3 className="text-sm font-black text-slate-900 uppercase">{item.name}</h3>
                                        <p className="mt-2 text-xs font-semibold text-slate-600">{item.purpose}</p>
                                        <ul className="mt-4 space-y-2">
                                            {(item.checks || []).slice(0, 5).map(check => (
                                                <li key={check} className="text-[11px] font-bold text-slate-600 flex gap-2">
                                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                                    <span>{check}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                            <div>
                                <h2 className="text-lg font-black uppercase text-slate-900">Prediction Summary</h2>
                                <p className="mt-1 text-xs font-semibold text-slate-600">
                                    Based on saved timetable, booking, and session data.
                                </p>
                            </div>
                            <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Detected Conflicts</p>
                                <p className="mt-2 text-3xl font-black text-rose-700">{insights?.conflicts?.total ?? 0}</p>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">High Demand Days</h3>
                                {(insights?.predictions?.high_demand_days || []).length === 0 ? (
                                    <p className="text-xs font-bold text-slate-500">Generate a timetable to start learning demand patterns.</p>
                                ) : (
                                    (insights?.predictions?.high_demand_days || []).map(item => (
                                        <div key={item.day} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                                            <span className="text-sm font-black text-slate-800">{item.day}</span>
                                            <span className="text-xs font-black text-indigo-700">{item.total} classes</span>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Configuration Gaps</p>
                                <p className="mt-2 text-xs font-bold text-amber-800">
                                    Tutors missing: {insights?.configuration_gaps?.sections_without_tutor ?? 0} |
                                    Home rooms missing: {insights?.configuration_gaps?.sections_without_home_room ?? 0}
                                </p>
                            </div>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
};

export default Automation;
