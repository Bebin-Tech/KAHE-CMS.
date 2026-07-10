import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    Home,
    LayoutDashboard,
    Users,
    School,
    Settings,
    Building2,
    Calendar,
    ChevronDown,
    ChevronRight,
    LogOut,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import API from '../api';
import { authClear, authGet } from '../authSession';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Sidebar = ({ isOpen, setIsOpen, isCollapsed, setIsCollapsed }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const role = authGet('role')?.toLowerCase();
    const userName = authGet('name') || 'Administrator';

    const [expandedGroups, setExpandedGroups] = useState(['Academic Management']);

    const handleLogout = async () => {
        try {
            await API.post('/logout/');
        } catch (e) {
            console.error("Logout audit failed:", e);
        }
        authClear();
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
            roles: ['admin', 'super_admin'],
            items: [
                { name: 'Dashboard', path: '/', icon: LayoutDashboard }
            ]
        },
        {
            title: 'Class Rooms',
            icon: School,
            roles: ['admin', 'super_admin', 'faculty', 'student'],
            items: [
                { name: 'Class Rooms', path: '/classroom-tracking' }
            ]
        },
        {
            title: 'Classroom Booking',
            icon: Calendar,
            roles: ['admin', 'super_admin', 'faculty'],
            items: [
                { name: 'Classroom Booking', path: '/classroom-booking' }
            ]
        },
        {
            title: 'User Directory',
            icon: Users,
            roles: ['admin', 'super_admin'],
            items: [
                { name: 'User Directory', path: '/users' }
            ]
        },
        {
            title: 'Department',
            icon: Building2,
            roles: ['admin', 'super_admin'],
            items: [
                { name: 'Department Module', path: '/departments' }
            ]
        },
        {
            title: 'Settings',
            icon: Settings,
            roles: ['student', 'faculty'],
            items: [
                { name: 'Settings Module', path: '/settings' }
            ]
        }
    ];

    const filteredNav = navigationData.filter(group => {
        if (group.roles) {
            const hasAccess = group.roles.includes(role) || (role === 'super_admin' && group.roles.includes('admin'));
            if (!hasAccess) return false;
        }
        return true;
    });

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
                <div className="h-24 flex items-center px-5 border-b border-slate-200 bg-white sticky top-0 z-10 shrink-0">
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
                        className="ml-auto p-1.5 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-indigo-600 transition-all hidden lg:block"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-90" />}
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden ml-auto p-2 text-slate-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
                    {filteredNav.map((group, idx) => (
                        <div key={idx} className="space-y-0.5">
                            <button
                                onClick={() => toggleGroup(group.title)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                                    expandedGroups.includes(group.title) ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                )}
                            >
                                <group.icon className={cn(
                                    "w-5 h-5 shrink-0 transition-colors duration-300",
                                    expandedGroups.includes(group.title) ? "text-indigo-700 scale-110" : "text-slate-600 group-hover:text-slate-800"
                                )} />
                                {!isCollapsed && (
                                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] font-semibold flex-1 text-left tracking-tight">
                                        {group.title}
                                    </motion.span>
                                )}
                                {!isCollapsed && group.items.length > 1 && (
                                    <ChevronRight className={cn(
                                        "w-3.5 h-3.5 transition-transform duration-300 text-slate-500 group-hover:text-slate-700",
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
                                        <div className="ml-5 border-l border-slate-200 pl-4 py-1 space-y-0.5">
                                            {group.items.map((item, iIdx) => (
                                                <Link
                                                    key={iIdx}
                                                    to={item.path}
                                                    className={cn(
                                                        "block py-2 text-[12px] font-medium transition-all hover:text-indigo-600 hover:translate-x-1",
                                                        location.pathname === item.path
                                                            ? "text-indigo-700 font-bold"
                                                            : "text-slate-700"
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
                <div className="p-3 border-t border-slate-200 bg-slate-50/40 shrink-0">
                    <div className={cn(
                        "flex items-center gap-3 p-2 rounded-2xl transition-all duration-300",
                        !isCollapsed ? "bg-white shadow-sm border border-slate-200" : "justify-center"
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
                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1 truncate">{role || 'Academic Staff'}</p>
                            </motion.div>
                        )}

                        {!isCollapsed && (
                            <button
                                onClick={handleLogout}
                                className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all group"
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
