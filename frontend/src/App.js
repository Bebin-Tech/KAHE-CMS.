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

    return (
        <Router>
            <div className="flex bg-gray-50 min-h-screen">
                {token && <Sidebar />}
                <main className="flex-1 overflow-x-hidden">
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                        <Route path="/rooms" element={<PrivateRoute><Rooms /></PrivateRoute>} />
                        <Route path="/rooms/:roomId" element={<PrivateRoute><RoomDetails /></PrivateRoute>} />
                        <Route path="/bookings" element={<PrivateRoute><Bookings /></PrivateRoute>} />
                        <Route path="/schedule" element={<PrivateRoute><Schedule /></PrivateRoute>} />
                        <Route path="/user-directory" element={<PrivateRoute><UserDirectory /></PrivateRoute>} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
