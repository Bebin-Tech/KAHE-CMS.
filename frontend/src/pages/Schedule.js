import React from 'react';

const Schedule = () => {
    const timeSlots = [
        { id: 'I', time: '9:00 AM - 9:50 AM' },
        { id: 'II', time: '9:50 AM - 10:55 AM' },
        { id: 'III', time: '11:15 AM - 12:00 PM' },
        { id: 'IV', time: '12:00 PM - 12:45 PM' },
        { id: 'V', time: '01:30 PM - 02:20 PM' },
        { id: 'VI', time: '02:20 PM - 03:10 PM' },
        { id: 'VII', time: '3:10 PM - 4:00 PM' },
    ];

    const Cell = ({ course, faculty, color, colSpan = 1 }) => (
        <td colSpan={colSpan} className={`${color} border border-gray-400 p-2 text-center align-middle h-20`}>
            <div className="flex flex-col justify-center h-full">
                <span className="font-black text-xs text-gray-900 leading-tight">{course}</span>
                <div className="w-full h-[1px] bg-gray-600/20 my-1"></div>
                <span className="font-bold text-[10px] text-gray-700">{faculty}</span>
            </div>
        </td>
    );

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
                            {/* Monday */}
                            <tr className="border-b border-gray-400">
                                <td className="bg-[#fef9c3] border border-gray-400 p-4 text-center font-black text-gray-800 text-sm uppercase">Monday</td>
                                <Cell course="<-- PY (LAB) RS(N4) ->" faculty="RS" color="bg-yellow-200" colSpan={2} />
                                <Cell course="ENG" faculty="SM" color="bg-orange-200" />
                                <Cell course="OS" faculty="RS" color="bg-green-300" />
                                <Cell course="MATHS" faculty="URR" color="bg-blue-300" />
                                <Cell course="CN" faculty="GA" color="bg-sky-300" />
                                <td className="border border-gray-400"></td>
                            </tr>

                            {/* Tuesday */}
                            <tr className="border-b border-gray-400">
                                <td className="bg-[#fef9c3] border border-gray-400 p-4 text-center font-black text-gray-800 text-sm uppercase">Tuesday</td>
                                <Cell course="<----- CN (LAB) AG(N4) ----->" faculty="AG" color="bg-yellow-200" colSpan={2} />
                                <td className="border border-gray-400"></td>
                                <Cell course="ENG" faculty="SM" color="bg-orange-200" />
                                <Cell course="TAMIL" faculty="NF2" color="bg-red-400 text-white" />
                                <Cell course="MATHS" faculty="URR" color="bg-blue-300" />
                                <td className="border border-gray-400"></td>
                            </tr>

                            {/* Wednesday */}
                            <tr className="border-b border-gray-400">
                                <td className="bg-[#fef9c3] border border-gray-400 p-4 text-center font-black text-gray-800 text-sm uppercase">Wednesday</td>
                                <Cell course="OS" faculty="RS" color="bg-green-300" />
                                <Cell course="CN" faculty="GA" color="bg-sky-300" />
                                <Cell course="PY (T)" faculty="RS" color="bg-yellow-200" />
                                <Cell course="OS" faculty="RS" color="bg-green-300" />
                                <Cell course="CESR" faculty="NVB" color="bg-amber-400" />
                                <Cell course="TAMIL" faculty="NF2" color="bg-red-400 text-white" />
                                <td className="border border-gray-400"></td>
                            </tr>

                            {/* Thursday */}
                            <tr className="border-b border-gray-400">
                                <td className="bg-[#fef9c3] border border-gray-400 p-4 text-center font-black text-gray-800 text-sm uppercase">Thursday</td>
                                <Cell course="OS" faculty="RS" color="bg-green-300" />
                                <Cell course="TAMIL" faculty="NF2" color="bg-red-400 text-white" />
                                <Cell course="MATHS" faculty="URR" color="bg-blue-300" />
                                <Cell course="CN (T)" faculty="AG" color="bg-yellow-200" />
                                <Cell course="CN" faculty="GA" color="bg-sky-300" />
                                <Cell course="ENG" faculty="SM" color="bg-orange-200" />
                                <td className="border border-gray-400"></td>
                            </tr>

                            {/* Friday */}
                            <tr className="border-b border-gray-400">
                                <td className="bg-[#fef9c3] border border-gray-400 p-4 text-center font-black text-gray-800 text-sm uppercase">Friday</td>
                                <Cell course="MATHS" faculty="URR" color="bg-blue-300" />
                                <Cell course="OS" faculty="RS" color="bg-green-300" />
                                <Cell course="CN" faculty="GA" color="bg-sky-300" />
                                <Cell course="PY (L) RS(N4)" faculty="RS" color="bg-yellow-200" />
                                <Cell course="TAMIL" faculty="NF2" color="bg-red-400 text-white" />
                                <Cell course="CESR" faculty="NVB" color="bg-amber-400" />
                                <td className="border border-gray-400"></td>
                            </tr>
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
                <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 rounded bg-blue-300 border border-gray-300"></div>
                    <span className="text-xs font-bold text-gray-500 uppercase">Specialized</span>
                </div>
            </div>
        </div>
    );
};

export default Schedule;
