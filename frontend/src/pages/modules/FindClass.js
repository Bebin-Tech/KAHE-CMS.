import React, { useState } from 'react';
import API from '../../api';
import { formatISTTime } from '../../timeUtils';
import { Search, MapPin, Clock, User, BookOpen, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FindClass = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        const val = e.target.value;
        setQuery(val);
        if (val.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const res = await API.get(`/find-class/?q=${val}`);
            setResults(res.data);
        } catch (err) {
            console.error("Search failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10 py-10">
            <header className="text-center space-y-4">
                <h1 className="text-5xl font-black text-slate-900 tracking-tightest uppercase italic">
                    Find <span className="text-indigo-600">Class</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em]">Locate any active session across campus</p>
            </header>

            <div className="relative group">
                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                    <Search className="text-slate-600 group-focus-within:text-indigo-600 transition-colors" size={24} />
                </div>
                <input
                    type="text"
                    className="w-full pl-16 pr-6 py-6 bg-white border-2 border-slate-300 rounded-[2.5rem] text-lg font-bold text-slate-900 shadow-xl shadow-slate-200/50 outline-none focus:border-indigo-500 transition-all placeholder:text-slate-500"
                    placeholder="Search Section, Faculty, or Subject..."
                    value={query}
                    onChange={handleSearch}
                    autoFocus
                />
                {loading && (
                    <div className="absolute inset-y-0 right-8 flex items-center">
                        <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-6">
                <AnimatePresence>
                    {results.map((session) => (
                        <motion.div
                            key={session.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-lg hover:shadow-2xl hover:border-indigo-300 transition-all group flex flex-col md:flex-row gap-8 items-center"
                        >
                            <div className="w-24 h-24 rounded-3xl bg-indigo-50 flex flex-col items-center justify-center text-indigo-600 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                <MapPin size={32} />
                                <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">{session.room_number}</span>
                            </div>

                            <div className="flex-1 space-y-4 text-center md:text-left">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{session.section_name || 'General Section'}</h3>
                                    <p className="text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">{session.subject_name}</p>
                                </div>

                                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
                                        <User size={14} className="text-slate-600" />
                                        <span className="text-xs font-bold text-slate-800 uppercase">{session.faculty_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
                                        <Clock size={14} className="text-slate-600" />
                                        <span className="text-xs font-bold text-slate-800 uppercase">Started {formatISTTime(session.start_time)} IST</span>
                                    </div>
                                </div>
                            </div>

                            <button className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 hover:bg-indigo-600 transition-all active:scale-95 shadow-lg">
                                <Navigation size={16} />
                                Navigate
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {query.length >= 2 && results.length === 0 && !loading && (
                    <div className="text-center py-20 text-slate-600">
                        <BookOpen size={64} className="mx-auto mb-4" />
                        <p className="text-lg font-black uppercase tracking-widest">No Active Sessions Found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FindClass;
