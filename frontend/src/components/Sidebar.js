import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const role = localStorage.getItem('role');

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
        window.location.reload();
    };

    const menuItems = [];

    // All authenticated users can see Class Room and Schedule
    menuItems.push({ name: 'Class Room', path: '/rooms', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' });
    menuItems.push({ name: 'Schedule', path: '/schedule', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' });

    // CR Booking - Hide for students, show for Faculty and Admin
    if (role === 'faculty' || role === 'admin') {
        menuItems.push({ name: 'CR Booking', path: '/bookings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' });
    }

    // Admin Only Modules
    if (role === 'admin') {
        menuItems.unshift({ name: 'Dashboard', path: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' });
        menuItems.push({ name: 'User Directory', path: '/user-directory', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' });
    }

    return (
        <React.Fragment>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                ></div>
            )}

            <div className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition duration-300 ease-in-out w-72 lg:w-80 bg-white border-r border-gray-100 flex flex-col h-screen shadow-2xl lg:shadow-sm z-50 overflow-hidden`}>

                {/* Header Section */}
                <div className="p-8 pb-4 flex flex-col items-center relative">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden absolute top-6 right-6 text-gray-400 hover:text-gray-600"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <img
                        src="/logo.svg"
                        alt="KAHE Logo"
                        className="w-24 h-24 object-contain mb-6"
                    />

                    <h1 className="text-3xl font-bold text-gray-800 tracking-tight text-center">KAHE CMS</h1>
                </div>

                {/* Main Menu Section */}
                <nav className="flex-1 px-6 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                    <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Main Menu</p>
                    {menuItems.map((item) => (
                        <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center space-x-4 px-5 py-4 rounded-2xl transition duration-200 group ${
                                location.pathname === item.path
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                                    : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <svg className={`h-6 w-6 ${location.pathname === item.path ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                            </svg>
                            <span className="font-bold text-[15px]">{item.name}</span>
                        </Link>
                    ))}
                </nav>

                {/* Account & Logout Section */}
                <div className="p-8 pt-4 bg-white border-t border-slate-50">
                    <div className="mb-6 px-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Authenticated Account</p>
                        <div className="flex items-center space-x-4">
                            <div className={`h-14 w-14 text-white rounded-[1.25rem] flex items-center justify-center font-black text-xl shadow-lg ${
                                role === 'admin' ? 'bg-green-600 shadow-green-100' : 'bg-violet-600 shadow-violet-100'
                            }`}>
                                {role?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-lg font-black text-slate-900 leading-tight uppercase">{role}</p>
                                <p className="text-[11px] text-green-500 font-bold flex items-center mt-1.5">
                                    <span className="h-2 w-2 bg-green-500 rounded-full mr-2.5"></span>
                                    Active Now
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-3 px-4 py-5 text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition duration-200 font-black text-sm uppercase tracking-[0.2em] shadow-sm border border-red-100"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </React.Fragment>
    );
};

export default Sidebar;
