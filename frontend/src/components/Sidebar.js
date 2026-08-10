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
    BookOpen,
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
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 1024;
    const [homeExpanded, setHomeExpanded] = useState(true);

    const hasRoleAccess = (roles = []) => (
        roles.includes(role) || (role === 'super_admin' && roles.includes('admin'))
    );

    const handleLogout = async () => {
        try {
            await API.post('/logout/');
        } catch (e) {
            console.error('Logout audit failed:', e);
        }
        authClear();
        navigate('/login');
        window.location.reload();
    };

    const navigationItems = [
        {
            name: 'Dashboard',
            path: '/',
            icon: LayoutDashboard,
            roles: ['admin', 'super_admin']
        },
        {
            name: 'Class Rooms',
            path: '/classroom-tracking',
            icon: School,
            roles: ['admin', 'super_admin', 'faculty', 'student']
        },
        {
            name: 'Classroom Booking',
            path: '/classroom-booking',
            icon: Calendar,
            roles: ['admin', 'super_admin', 'faculty']
        },
        {
            name: 'Department',
            path: '/departments',
            icon: Building2,
            roles: ['admin', 'super_admin']
        },
        {
            name: 'Subject',
            path: '/subjects',
            icon: BookOpen,
            roles: ['admin', 'super_admin']
        },
        {
            name: 'User',
            path: '/users',
            icon: Users,
            roles: ['admin', 'super_admin']
        },
        {
            name: 'Settings',
            path: '/settings',
            icon: Settings,
            roles: ['student', 'faculty']
        }
    ];

    const visibleItems = navigationItems.filter((item) => hasRoleAccess(item.roles));
    const homePath = hasRoleAccess(['admin', 'super_admin']) ? '/' : '/classroom-tracking';

    const handleHomeClick = () => {
        if (isCollapsed) {
            setIsCollapsed(false);
            setHomeExpanded(true);
            return;
        }
        setHomeExpanded((expanded) => !expanded);
    };

    return (
        <>
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
                    width: isCollapsed ? 78 : 300,
                    x: isOpen ? 0 : (isMobileViewport ? -300 : 0)
                }}
                className={cn(
                    'fixed lg:relative inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out shadow-xl lg:shadow-none h-screen',
                    !isOpen && 'hidden lg:flex'
                )}
            >
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
                        className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-blue-700 transition-all hidden lg:block"
                        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <ChevronDown className={cn('w-4 h-4 transition-transform', isCollapsed ? '-rotate-90' : 'rotate-90')} />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden ml-auto p-2 text-slate-600"
                        title="Close sidebar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 py-5 custom-scrollbar">
                    <button
                        type="button"
                        onClick={handleHomeClick}
                        className={cn(
                            'w-full flex items-center rounded-[18px] border border-blue-200 bg-blue-50 text-slate-900 shadow-sm transition-all',
                            isCollapsed ? 'justify-center px-0 py-4' : 'gap-4 px-5 py-4'
                        )}
                    >
                        <Home className="w-5 h-5 text-blue-600 shrink-0" />
                        {!isCollapsed && (
                            <>
                                <span className="text-[15px] font-black flex-1 text-left tracking-tight">Home</span>
                                <ChevronDown
                                    className={cn(
                                        'w-5 h-5 text-slate-500 transition-transform duration-300',
                                        homeExpanded ? 'rotate-180' : ''
                                    )}
                                />
                            </>
                        )}
                    </button>

                    <AnimatePresence initial={false}>
                        {!isCollapsed && homeExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="ml-3 border-l border-blue-100 pl-4 py-2 space-y-2">
                                    {visibleItems.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = location.pathname === item.path;
                                        return (
                                            <Link
                                                key={item.path}
                                                to={item.path}
                                                onClick={() => setIsOpen(false)}
                                                className={cn(
                                                    'flex items-center gap-4 rounded-[18px] px-4 py-3.5 text-slate-700 transition-all duration-200',
                                                    'hover:bg-blue-50 hover:text-slate-950 hover:shadow-sm',
                                                    isActive && 'border border-blue-200 bg-blue-50 text-slate-950 shadow-sm'
                                                )}
                                            >
                                                <Icon
                                                    className={cn(
                                                        'w-5 h-5 shrink-0',
                                                        isActive ? 'text-blue-600' : 'text-slate-500'
                                                    )}
                                                />
                                                <span className="text-[15px] font-black tracking-tight">{item.name}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isCollapsed && (
                        <div className="mt-3 space-y-2">
                            {visibleItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path || (item.path === homePath && location.pathname === '/');
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => setIsOpen(false)}
                                        className={cn(
                                            'flex h-11 w-full items-center justify-center rounded-2xl text-slate-500 transition-all',
                                            'hover:bg-blue-50 hover:text-blue-700',
                                            isActive && 'bg-blue-50 text-blue-700 border border-blue-200'
                                        )}
                                        title={item.name}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </nav>

                <div className="p-3 border-t border-slate-200 bg-white shrink-0">
                    <div className={cn(
                        'flex items-center gap-3 rounded-2xl transition-all duration-300',
                        isCollapsed ? 'justify-center p-1' : 'border border-slate-200 bg-white p-2 shadow-sm'
                    )}>
                        <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm uppercase shadow-md">
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
                                className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all group"
                                title="Logout"
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
