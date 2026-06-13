import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Bookings from './pages/Bookings';
import Schedule from './pages/Schedule';
import RoomDetails from './pages/RoomDetails';
import UserDirectory from './pages/UserDirectory';
import TimetableManagement from './pages/TimetableManagement';
import Sidebar from './components/Sidebar';

function App() {
    const [authState, setAuthState] = useState({
        token: localStorage.getItem('token'),
        role: localStorage.getItem('role'),
        name: localStorage.getItem('name')
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const syncAuth = () => {
            const currentToken = localStorage.getItem('token');
            const currentRole = localStorage.getItem('role');
            const currentName = localStorage.getItem('name');

            if (currentToken !== authState.token || currentRole !== authState.role) {
                setAuthState({
                    token: currentToken,
                    role: currentRole,
                    name: currentName
                });
            }
        };

        window.addEventListener('storage', syncAuth);
        const timer = setInterval(syncAuth, 500);

        return () => {
            window.removeEventListener('storage', syncAuth);
            clearInterval(timer);
        };
    }, [authState]);

    const PrivateRoute = ({ children, allowedRoles = [] }) => {
        if (!authState.token) return <Navigate to="/login" replace />;
        if (allowedRoles.length > 0 && !allowedRoles.includes(authState.role)) {
            return <Navigate to="/" replace />;
        }
        return children;
    };

    return (
        <Router>
            <div className="flex bg-gray-50 h-screen overflow-hidden relative font-sans">
                {authState.token && (
                    <Sidebar
                        isOpen={isSidebarOpen}
                        setIsOpen={setIsSidebarOpen}
                        role={authState.role}
                    />
                )}

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {authState.token && (
                        <header className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center space-x-3 z-30">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                            <div className="flex items-center space-x-3">
                                <img src="/logo.svg" alt="Logo" className="h-8 w-8" />
                                <span className="font-black text-gray-800 uppercase tracking-tighter">KAHE CMS</span>
                            </div>
                        </header>
                    )}

                    <main className="flex-1 overflow-y-auto bg-gray-50">
                        <Suspense fallback={<div className="p-10 text-center font-black text-gray-300">LOADING...</div>}>
                            <Routes>
                                <Route path="/login" element={!authState.token ? <Login /> : <Navigate to="/" replace />} />
                                <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                                <Route path="/rooms" element={<PrivateRoute><Rooms /></PrivateRoute>} />
                                <Route path="/rooms/:roomId" element={<PrivateRoute><RoomDetails /></PrivateRoute>} />
                                <Route path="/bookings" element={<PrivateRoute><Bookings /></PrivateRoute>} />
                                <Route path="/schedule" element={<PrivateRoute><Schedule /></PrivateRoute>} />
                                <Route path="/timetable-management" element={
                                    <PrivateRoute allowedRoles={['admin', 'hod']}>
                                        <TimetableManagement />
                                    </PrivateRoute>
                                } />
                                <Route path="/user-directory" element={
                                    <PrivateRoute allowedRoles={['admin']}>
                                        <UserDirectory />
                                    </PrivateRoute>
                                } />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </Suspense>
                    </main>
                </div>
            </div>
        </Router>
    );
}

export default App;
