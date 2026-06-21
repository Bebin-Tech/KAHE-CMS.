import React from 'react';
import RegistryPage from '../../components/RegistryPage';
import { useRegistry } from '../../context/RegistryContext';

const Rooms = () => {
    const { datasets, lookups, fetchData, saving, setSaving, readiness } = useRegistry();
    const config = {
        title: 'Institutional Spaces', endpoint: '/rooms/',
        columns: [['room_number', 'Room'], ['type', 'Type'], ['capacity', 'Seats'], ['status', 'Status']],
        fields: [
            { key: 'room_number', label: 'Room Index', required: true },
            { key: 'type', label: 'Facility Type', type: 'select', options: ['Classroom', 'Lab', 'Seminar Hall'], required: true },
            { key: 'capacity', label: 'Occupancy Limit', type: 'number', required: true },
            { key: 'building', label: 'Building/Block' },
            { key: 'status', label: 'Operational Status', type: 'select', options: ['Available', 'Occupied'] }
        ]
    };
    return <RegistryPage moduleKey="rooms" config={config} datasets={datasets} lookups={lookups} fetchData={fetchData} saving={saving} setSaving={setSaving} readiness={readiness} />;
};

export default Rooms;
