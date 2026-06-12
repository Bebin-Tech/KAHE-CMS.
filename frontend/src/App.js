import React, { useState, useEffect } from 'react';
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

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" />;
};

function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [role, setRole] = useState(localStorage.getItem('role'));
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Listen for changes in localStorage (login/logout from other tabs)
    useEffect(() => {
        const handleStorageChange = () => {
            setToken(localStorage.getItem('token'));
            setRole(localStorage.getItem('role'));
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // A small hack to force App to check localStorage after Login redirects
    // because standard routing doesn't trigger state changes in parent components.
    useEffect(() => {
        const interval = setInterval(() => {
            const currentToken = localStorage.getItem('token');
            if (currentToken !== token) {
                setToken(currentToken);
                setRole(localStorage.getItem('role'));
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [token]);

    return (
        <Router>
            <div className="flex bg-gray-50 h-screen overflow-hidden relative">
                {token && (
                    <Sidebar
                        isOpen={isSidebarOpen}
                        setIsOpen={setIsSidebarOpen}
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

                    <main className="flex-1 overflow-y-auto focus:outline-none">
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                            <Route path="/rooms" element={<PrivateRoute><Rooms /></PrivateRoute>} />
                            <Route path="/rooms/:roomId" element={<PrivateRoute><RoomDetails /></PrivateRoute>} />
                            <Route path="/bookings" element={<PrivateRoute><Bookings /></PrivateRoute>} />
                            <Route path="/schedule" element={<PrivateRoute><Schedule /></PrivateRoute>} />
                            <Route path="/timetable-management" element={
                                <PrivateRoute>
                                    {role === 'admin' ? <TimetableManagement /> : <Navigate to="/" />}
                                </PrivateRoute>
                            } />
                            <Route path="/user-directory" element={
                                <PrivateRoute>
                                    {role === 'admin' ? <UserDirectory /> : <Navigate to="/" />}
                                </PrivateRoute>
                            } />
                        </Routes>
                    </main>
                </div>
            </div>
        </Router>
    );
}

export default App;
