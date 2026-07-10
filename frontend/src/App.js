import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/Sidebar';
import { RegistryProvider } from './context/RegistryContext';

import UserManagement from './pages/modules/UserManagement';
import ClassroomTracking from './pages/modules/ClassroomTracking';
import ClassroomBooking from './pages/modules/ClassroomBooking';
import Settings from './pages/modules/Settings';
import Departments from './pages/modules/Departments';

const roleHome = () => {
    const role = localStorage.getItem('role')?.toLowerCase();
    return role === 'admin' || role === 'super_admin' ? '/' : '/classroom-tracking';
};

const PrivateRoute = ({ children, roles }) => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role')?.toLowerCase();
    // Ensure we replace history to prevent blinking loops
    if (!token) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(role)) return <Navigate to={roleHome()} replace />;
    return children;
};

const PublicRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    // If logged in, don't allow access to login page
    return token ? <Navigate to="/" replace /> : children;
};

function App() {
    const token = localStorage.getItem('token');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <RegistryProvider>
            <Router>
                <div className="flex bg-gray-50 h-screen overflow-hidden relative">
                    {token && (
                        <Sidebar
                            isOpen={isSidebarOpen}
                            setIsOpen={setIsSidebarOpen}
                            isCollapsed={isCollapsed}
                            setIsCollapsed={setIsCollapsed}
                        />
                    )}

                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        {token && (
                            <header className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center space-x-3 z-30">
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none"
                                >
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                                <div className="flex items-center space-x-3">
                                    <img src="/logo.svg" alt="Logo" className="h-8 w-8" />
                                    <span className="font-bold text-gray-800">KAHE CMS</span>
                                </div>
                            </header>
                        )}

                        <main className="flex-1 overflow-y-auto focus:outline-none p-4 md:p-8">
                            <Routes>
                                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                                <Route path="/" element={<PrivateRoute roles={['admin', 'super_admin']}><Dashboard /></PrivateRoute>} />

                                <Route path="/users" element={<PrivateRoute roles={['admin', 'super_admin']}><UserManagement /></PrivateRoute>} />
                                <Route path="/departments" element={<PrivateRoute roles={['admin', 'super_admin']}><Departments /></PrivateRoute>} />
                                <Route path="/settings" element={<PrivateRoute roles={['student', 'faculty']}><Settings /></PrivateRoute>} />
                                <Route path="/classroom-booking" element={<PrivateRoute roles={['faculty']}><ClassroomBooking /></PrivateRoute>} />
                                <Route path="/classroom-tracking" element={<PrivateRoute><ClassroomTracking /></PrivateRoute>} />

                                <Route path="*" element={<Navigate to="/" />} />
                            </Routes>
                        </main>
                    </div>
                </div>
            </Router>
        </RegistryProvider>
    );
}

export default App;
