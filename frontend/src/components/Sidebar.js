import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    School,
    Calendar,
    Users,
    Settings,
    LogOut,
    BookOpen
} from 'lucide-react';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const role = localStorage.getItem('role')?.toLowerCase();

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
        window.location.reload();
    };

    const menuItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Classroom Module', path: '/rooms', icon: School },
        { name: 'CR Booking', path: '/bookings', icon: Calendar, roles: ['admin', 'hod', 'dean', 'faculty'] },
        { name: 'Personal Schedule', path: '/schedule', icon: Calendar },
        { name: 'Timetable Manager', path: '/timetable/academic/departments', icon: BookOpen, roles: ['admin', 'hod', 'dean'] },
        { name: 'User Directory', path: '/user-directory', icon: Users, roles: ['admin'] }
    ];

    return (
        <React.Fragment>
            {isOpen && <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)}></div>}
            <div className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition duration-300 ease-in-out w-72 bg-white border-r border-gray-200 flex flex-col h-screen shadow-xl lg:shadow-none z-50 overflow-hidden`}>
                <div className="p-8 flex flex-col items-center space-y-4 border-b border-gray-50">
                    <img src="/logo.svg" alt="KAHE Logo" className="w-16 h-16 object-contain mb-2" />
                    <div className="text-center">
                        <span className="text-xl font-black text-gray-800 tracking-tightest uppercase italic">KAHE CMS</span>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Institutional ERP</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scrollbar">
                    {menuItems.filter(i => !i.roles || i.roles.includes(role)).map((item) => (
                        <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition duration-200 group ${
                                location.pathname === item.path ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'
                            }`}
                        >
                            <item.icon size={20} className={location.pathname === item.path ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'} />
                            <span className="font-bold text-sm tracking-tight">{item.name}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-6 border-t border-gray-100 bg-white">
                    <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 py-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest">
                        <LogOut size={16} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </React.Fragment>
    );
};

export default Sidebar;
