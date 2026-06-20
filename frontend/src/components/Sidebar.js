import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    Home,
    LayoutDashboard,
    BookOpen,
    Users,
    School,
    Calendar,
    BarChart3,
    Settings,
    ClipboardList,
    ChevronDown,
    ChevronRight,
    Search,
    Bell,
    LogOut,
    User as UserIcon,
    Menu,
    X,
    FolderOpen,
    GraduationCap,
    Clock,
    FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Sidebar = ({ isOpen, setIsOpen, isCollapsed, setIsCollapsed }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const role = localStorage.getItem('role')?.toLowerCase();
    const userName = localStorage.getItem('name') || 'Administrator';

    const [expandedGroups, setExpandedGroups] = useState(['Academic Management']);
    const [searchTerm, setSearchTerm] = useState('');

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
        window.location.reload();
    };

    const toggleGroup = (groupName) => {
        if (isCollapsed) {
            setIsCollapsed(false);
            setExpandedGroups([groupName]);
            return;
        }
        setExpandedGroups(prev =>
            prev.includes(groupName) ? prev.filter(g => g !== groupName) : [...prev, groupName]
        );
    };

    // ERPNext Style Navigation Data
    const navigationData = [
        {
            title: 'Home',
            icon: Home,
            items: [
                { name: 'Dashboard', path: '/', icon: LayoutDashboard }
            ]
        },
        {
            title: 'Academic Management',
            icon: BookOpen,
            roles: ['admin', 'hod', 'dean', 'principal'],
            items: [
                { name: 'Departments', path: '/timetable/academic/departments' },
                { name: 'Programs', path: '/timetable/academic/programs' },
                { name: 'Semesters', path: '/timetable/academic/semesters' },
                { name: 'Sections', path: '/timetable/academic/sections' },
                { name: 'Subjects', path: '/timetable/academic/subjects' }
            ]
        },
        {
            title: 'Faculty Management',
            icon: Users,
            roles: ['admin', 'hod', 'dean', 'principal'],
            items: [
                { name: 'Faculty Directory', path: '/timetable/faculty/directory' },
                { name: 'Faculty Mapping', path: '/timetable/faculty/mapping' },
                { name: 'Workload Analytics', path: '/timetable/faculty/workload' },
                { name: 'Faculty Availability', path: '/timetable/faculty/availability' }
            ]
        },
        {
            title: 'Classroom Management',
            icon: School,
            items: [
                { name: 'Classrooms', path: '/timetable/spatial/infrastructure' },
                { name: 'Laboratories', path: '/timetable/spatial/infrastructure' },
                { name: 'Room Allocation', path: '/timetable/spatial/occupancy' },
                { name: 'Resource Booking', path: '/bookings' }
            ]
        },
        {
            title: 'Timetable Management',
            icon: Calendar,
            roles: ['admin', 'hod', 'dean', 'principal', 'faculty'],
            items: [
                { name: 'Timetable Dashboard', path: '/timetable/dashboard' },
                { name: 'Timetable Matrix', path: '/timetable/matrix' },
                { name: 'Auto Scheduler', path: '/timetable/dashboard' },
                { name: 'Conflict Resolution', path: '/timetable/dashboard' },
                { name: 'Published Timetables', path: '/timetable/dashboard' }
            ]
        },
        {
            title: 'Reports & Analytics',
            icon: BarChart3,
            roles: ['admin', 'hod', 'dean', 'principal'],
            items: [
                { name: 'Faculty Reports', path: '/timetable/reports/faculty' },
                { name: 'Department Reports', path: '/timetable/reports/department' },
                { name: 'Classroom Reports', path: '/timetable/reports/classroom' },
                { name: 'Utilization Analytics', path: '/timetable/reports/utilization' }
            ]
        },
        {
            title: 'Administration',
            icon: Settings,
            roles: ['admin'],
            items: [
                { name: 'Academic Year', path: '/timetable/settings' },
                { name: 'Semester Configuration', path: '/timetable/settings' },
                { name: 'Working Days', path: '/timetable/settings' },
                { name: 'Period Timings', path: '/timetable/settings' },
                { name: 'System Settings', path: '/timetable/settings' }
            ]
        },
        {
            title: 'Audit & Logs',
            icon: ClipboardList,
            roles: ['admin'],
            items: [
                { name: 'Activity Logs', path: '/timetable/audit/logs' },
                { name: 'Audit History', path: '/timetable/audit/history' },
                { name: 'Timetable Change History', path: '/timetable/audit/history' }
            ]
        }
    ];

    const filteredNav = navigationData.filter(group => {
        if (group.roles && !group.roles.includes(role)) return false;

        if (searchTerm) {
            const matchesGroup = group.title.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesItems = group.items.some(item =>
                item.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            return matchesGroup || matchesItems;
        }
        return true;
    }).map(group => {
        if (searchTerm && !group.title.toLowerCase().includes(searchTerm.toLowerCase())) {
            return {
                ...group,
                items: group.items.filter(item =>
                    item.name.toLowerCase().includes(searchTerm.toLowerCase())
                )
            };
        }
        return group;
    });

    useEffect(() => {
        if (searchTerm) {
            setExpandedGroups(filteredNav.map(g => g.title));
        }
    }, [searchTerm]);

    return (
        <>
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setIsOpen(false)}
                    />
                )}
            </AnimatePresence>

            <motion.aside
                initial={false}
                animate={{
                    width: isCollapsed ? 72 : 260,
                    x: isOpen ? 0 : (window.innerWidth < 1024 ? -260 : 0)
                }}
                className={cn(
                    "fixed lg:relative inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out shadow-xl lg:shadow-none h-screen",
                    !isOpen && "hidden lg:flex"
                )}
            >
                {/* Header: Logo & Branding */}
                <div className="h-24 flex items-center px-5 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <img
                            src="/logo.svg"
                            alt="KAHE Logo"
                            className="w-14 h-14 object-contain shrink-0 transition-all duration-300"
                        />
                        {!isCollapsed && (
                            <motion.h1
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-xl font-black text-slate-900 truncate tracking-tighter"
                            >
                                KAHE CMS
                            </motion.h1>
                        )}
                    </div>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="ml-auto p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all hidden lg:block"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-90" />}
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden ml-auto p-2 text-slate-400"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-4 py-4 shrink-0">
                    <div className={cn(
                        "relative group transition-all duration-300",
                        isCollapsed ? "w-10 mx-auto" : "w-full"
                    )}>
                        <Search className={cn(
                            "absolute top-1/2 -translate-y-1/2 w-4 h-4 transition-all duration-300",
                            isCollapsed ? "left-1/2 -translate-x-1/2 text-slate-400 group-hover:text-indigo-500" : "left-3 text-slate-400 group-focus-within:text-indigo-500"
                        )} />
                        {!isCollapsed ? (
                            <input
                                type="text"
                                placeholder="Search modules..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                            />
                        ) : (
                            <div className="w-full h-9 cursor-pointer" onClick={() => setIsCollapsed(false)} />
                        )}
                    </div>
                </div>

                {/* Main Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
                    {filteredNav.map((group, idx) => (
                        <div key={idx} className="space-y-0.5">
                            <button
                                onClick={() => toggleGroup(group.title)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                                    expandedGroups.includes(group.title) ? "bg-slate-50 text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-slate-50/80 hover:text-slate-900"
                                )}
                            >
                                <group.icon className={cn(
                                    "w-5 h-5 shrink-0 transition-colors duration-300",
                                    expandedGroups.includes(group.title) ? "text-indigo-600 scale-110" : "text-slate-400 group-hover:text-slate-600"
                                )} />
                                {!isCollapsed && (
                                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] font-semibold flex-1 text-left tracking-tight">
                                        {group.title}
                                    </motion.span>
                                )}
                                {!isCollapsed && group.items.length > 1 && (
                                    <ChevronRight className={cn(
                                        "w-3.5 h-3.5 transition-transform duration-300 text-slate-300 group-hover:text-slate-400",
                                        expandedGroups.includes(group.title) ? "rotate-90 text-indigo-400" : ""
                                    )} />
                                )}
                            </button>

                            <AnimatePresence>
                                {!isCollapsed && expandedGroups.includes(group.title) && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="ml-5 border-l border-slate-100 pl-4 py-1 space-y-0.5">
                                            {group.items.map((item, iIdx) => (
                                                <Link
                                                    key={iIdx}
                                                    to={item.path}
                                                    className={cn(
                                                        "block py-2 text-[12px] font-medium transition-all hover:text-indigo-600 hover:translate-x-1",
                                                        location.pathname === item.path
                                                            ? "text-indigo-600 font-bold"
                                                            : "text-slate-500"
                                                    )}
                                                >
                                                    {item.name}
                                                </Link>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </nav>

                {/* User Profile Section (Bottom) */}
                <div className="p-3 border-t border-slate-100 bg-slate-50/20 shrink-0">
                    <div className={cn(
                        "flex items-center gap-3 p-2 rounded-2xl transition-all duration-300",
                        !isCollapsed ? "bg-white shadow-sm border border-slate-100" : "justify-center"
                    )}>
                        <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm uppercase shadow-lg shadow-indigo-100">
                                {userName.charAt(0)}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-[3px] border-white rounded-full"></div>
                        </div>

                        {!isCollapsed && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0 flex-1">
                                <p className="text-[13px] font-black text-slate-900 truncate leading-tight">{userName}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">{role || 'Academic Staff'}</p>
                            </motion.div>
                        )}

                        {!isCollapsed && (
                            <button
                                onClick={handleLogout}
                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all group"
                                title="Sign Out"
                            >
                                <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>
            </motion.aside>
        </>
    );
};

export default Sidebar;
