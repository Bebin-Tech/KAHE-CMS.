import React, { useEffect, useState } from 'react';
import API from '../api';

const Schedule = () => {
    const [schedules, setSchedules] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);

    const timeSlots = [
        { id: 'I', time: '9:00 AM - 9:50 AM' },
        { id: 'II', time: '9:50 AM - 10:55 AM' },
        { id: 'III', time: '11:15 AM - 12:00 PM' },
        { id: 'IV', time: '12:00 PM - 12:45 PM' },
        { id: 'V', time: '01:30 PM - 02:20 PM' },
        { id: 'VI', time: '02:20 PM - 03:10 PM' },
        { id: 'VII', time: '3:10 PM - 4:00 PM' },
    ];

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [schRes, roomsRes] = await Promise.all([
                    API.get('/schedules'),
                    API.get('/rooms')
                ]);
                setSchedules(schRes.data || []);
                setRooms(roomsRes.data || []);
                setLoading(false);
            } catch (err) {
                console.error("Schedule fetch error:", err);
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const getScheduleForCell = (day, slot) => {
        // Find schedule for this day and slot
        // Slot.time in backend might be exact string from timeSlots
        return schedules.find(s => s.day_of_week === day && s.time_slot === slot.time);
    };

    const Cell = ({ day, slot }) => {
        const item = getScheduleForCell(day, slot);
        if (!item) return <td className="border border-gray-400"></td>;

        const roomNum = rooms.find(r => r.id === item.room_id)?.room_number || 'N/A';
        const isLab = item.subject.toLowerCase().includes('lab');
        const color = isLab ? 'bg-yellow-200' : 'bg-green-300';

        return (
            <td className={`${color} border border-gray-400 p-2 text-center align-middle h-20`}>
                <div className="flex flex-col justify-center h-full">
                    <span className="font-black text-[10px] text-gray-900 leading-tight uppercase">{item.subject}</span>
                    <div className="w-full h-[1px] bg-gray-600/20 my-1"></div>
                    <span className="font-bold text-[9px] text-gray-700">ROOM {roomNum}</span>
                </div>
            </td>
        );
    };

    if (loading) return <div className="p-10 text-center font-bold text-gray-400 animate-pulse">LOADING TIMETABLE...</div>;

    return (
        <div className="p-10 bg-gray-50 min-h-screen">
            <header className="mb-8">
                <h1 className="text-4xl font-black text-gray-900 tracking-tight">Academic Timetable</h1>
                <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-xs">Official Class Schedule • KAHE CMS</p>
            </header>

            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse table-fixed min-w-[1000px]">
                        <thead>
                            <tr className="bg-[#fef9c3] border-b border-gray-400">
                                <th rowSpan="2" className="border border-gray-400 p-4 text-center font-black text-gray-800 text-sm w-32 uppercase tracking-tighter">
                                    Day Order / Hours
                                </th>
                                {timeSlots.map(slot => (
                                    <th key={slot.id} className="border border-gray-400 p-2 text-center font-black text-gray-800 text-sm">
                                        {slot.id}
                                    </th>
                                ))}
                            </tr>
                            <tr className="bg-[#fef9c3]">
                                {timeSlots.map(slot => (
                                    <th key={slot.time} className="border border-gray-400 p-1 text-[10px] font-bold text-gray-600 text-center uppercase leading-none whitespace-pre-line">
                                        {slot.time.split(' - ').join('\n-\n')}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {days.map(day => (
                                <tr key={day} className="border-b border-gray-400">
                                    <td className="bg-[#fef9c3] border border-gray-400 p-4 text-center font-black text-gray-800 text-sm uppercase">{day}</td>
                                    {timeSlots.map(slot => (
                                        <Cell key={`${day}-${slot.id}`} day={day} slot={slot} />
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-8 flex gap-4">
                <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 rounded bg-yellow-200 border border-gray-300"></div>
                    <span className="text-xs font-bold text-gray-500 uppercase">Lab Sessions</span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 rounded bg-green-300 border border-gray-300"></div>
                    <span className="text-xs font-bold text-gray-500 uppercase">Theory</span>
                </div>
            </div>
        </div>
    );
};

export default Schedule;
