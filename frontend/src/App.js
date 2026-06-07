import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Bookings from './pages/Bookings';
import Schedule from './pages/Schedule';
import RoomDetails from './pages/RoomDetails';
import UserDirectory from './pages/UserDirectory';
import Sidebar from './components/Sidebar';

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" />;
};

function App() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    return (
        <Router>
            <div className="flex bg-gray-50 h-screen overflow-hidden">
                {token && <Sidebar />}
                <main className="flex-1 overflow-y-auto">
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={
                            <PrivateRoute>
                                {role === 'admin' ? <Dashboard /> : <Navigate to="/rooms" />}
                            </PrivateRoute>
                        } />
                        <Route path="/rooms" element={<PrivateRoute><Rooms /></PrivateRoute>} />
                        <Route path="/rooms/:roomId" element={<PrivateRoute><RoomDetails /></PrivateRoute>} />
                        <Route path="/bookings" element={<PrivateRoute><Bookings /></PrivateRoute>} />
                        <Route path="/schedule" element={
                            <PrivateRoute>
                                {role === 'admin' ? <Schedule /> : <Navigate to="/rooms" />}
                            </PrivateRoute>
                        } />
                        <Route path="/user-directory" element={
                            <PrivateRoute>
                                {role === 'admin' ? <UserDirectory /> : <Navigate to="/rooms" />}
                            </PrivateRoute>
                        } />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
