import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const role = localStorage.getItem('role')?.toLowerCase();

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
        window.location.reload();
    };

    const menuItems = [];

    // 1. Dashboard
    menuItems.push({ name: 'Dashboard', path: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' });

    // 2. Classroom Module (Explicitly placed and named)
    menuItems.push({ name: 'Classroom Module', path: '/rooms', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' });

    // 3. CR Booking
    if (['faculty', 'admin', 'hod', 'dean', 'principal'].includes(role)) {
        menuItems.push({ name: 'CR Booking', path: '/bookings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' });
    }

    // 4. Schedule
    menuItems.push({ name: 'Personal Schedule', path: '/schedule', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' });

    // 5. Timetable Manager (CMS Core)
    if (['admin', 'dean', 'hod', 'principal'].includes(role)) {
        menuItems.push({ name: 'Timetable Manager', path: '/timetable-manager', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' });
    }

    // 6. User Directory
    if (role === 'admin') {
        menuItems.push({ name: 'User Directory', path: '/user-directory', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' });
    }

    return (
        <React.Fragment>
            {isOpen && <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)}></div>}
            <div className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition duration-300 ease-in-out w-72 bg-white border-r border-gray-200 flex flex-col h-screen shadow-xl lg:shadow-sm z-50 overflow-hidden`}>
                <div className="p-8 flex flex-col items-center space-y-4 border-b border-gray-50 bg-white z-10">
                    <img src="/logo.svg" alt="KAHE Logo" className="w-24 h-24 object-contain mb-2" />
                    <div className="text-center">
                        <span className="text-2xl font-black text-gray-800 tracking-tight leading-tight">KAHE CMS</span>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Campus Management</p>
                    </div>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
                    <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Institutional Modules</p>
                    {menuItems.map((item) => (
                        <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-2xl transition duration-200 group ${
                                location.pathname === item.path ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                            }`}
                        >
                            <svg className={`h-5 w-5 ${location.pathname === item.path ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                            </svg>
                            <span className="font-bold text-sm tracking-tight">{item.name}</span>
                        </Link>
                    ))}
                </nav>
                <div className="p-6 border-t border-gray-100 bg-white mt-auto">
                    <div className="mb-4 px-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Active Session</p>
                        <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-2xl">
                            <div className="h-10 w-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm uppercase">{role?.charAt(0) || 'U'}</div>
                            <div className="min-w-0">
                                <p className="text-xs font-black text-gray-900 truncate uppercase">{role || 'User'}</p>
                                <div className="flex items-center text-[10px] text-green-500 font-bold"><span className="h-1.5 w-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>ONLINE</div>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 py-3 border-2 border-red-500 text-red-500 rounded-xl hover:bg-red-50 transition-colors font-bold text-xs uppercase tracking-widest">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </React.Fragment>
    );
};

export default Sidebar;
