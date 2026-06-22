import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/Sidebar';
import TimetableManager from './pages/TimetableManager';
import { RegistryProvider } from './context/RegistryContext';

// Module Pages
import Departments from './pages/modules/Departments';
import Programs from './pages/modules/Programs';
import Semesters from './pages/modules/Semesters';
import Sections from './pages/modules/Sections';
import Subjects from './pages/modules/Subjects';
import UserManagement from './pages/modules/UserManagement';
import FacultyMapping from './pages/modules/FacultyMapping';
import CurriculumMap from './pages/modules/CurriculumMap';
import Rooms from './pages/modules/Rooms';
import ClassroomTracking from './pages/modules/ClassroomTracking';

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    // Ensure we replace history to prevent blinking loops
    return token ? children : <Navigate to="/login" replace />;
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
                                <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

                                {/* Dedicated Module Routes */}
                                <Route path="/departments" element={<PrivateRoute><Departments /></PrivateRoute>} />
                                <Route path="/programs" element={<PrivateRoute><Programs /></PrivateRoute>} />
                                <Route path="/semesters" element={<PrivateRoute><Semesters /></PrivateRoute>} />
                                <Route path="/sections" element={<PrivateRoute><Sections /></PrivateRoute>} />
                                <Route path="/subjects" element={<PrivateRoute><Subjects /></PrivateRoute>} />
                                <Route path="/users" element={<PrivateRoute><UserManagement /></PrivateRoute>} />
                                <Route path="/mappings" element={<PrivateRoute><FacultyMapping /></PrivateRoute>} />
                                <Route path="/curriculum" element={<PrivateRoute><CurriculumMap /></PrivateRoute>} />
                                <Route path="/rooms" element={<PrivateRoute><Rooms /></PrivateRoute>} />
                                <Route path="/classroom-tracking" element={<PrivateRoute><ClassroomTracking /></PrivateRoute>} />

                                {/* Legacy Routes / Fallback */}
                                <Route path="/timetable/*" element={<PrivateRoute><TimetableManager /></PrivateRoute>} />
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
