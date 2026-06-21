import React from 'react';
import RegistryPage from '../../components/RegistryPage';
import { useRegistry } from '../../context/RegistryContext';

const Departments = () => {
    const { datasets, lookups, fetchData, saving, setSaving, readiness } = useRegistry();
    const config = {
        title: 'Department Registry', endpoint: '/departments/',
        columns: [['code', 'Code'], ['name', 'Name'], ['classification', 'Classification'], ['status', 'Status']],
        fields: [
            { key: 'code', label: 'Unique Code', required: true },
            { key: 'name', label: 'Department Name', required: true },
            { key: 'classification', label: 'Classification', required: true },
            { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
        ]
    };
    return <RegistryPage moduleKey="departments" config={config} datasets={datasets} lookups={lookups} fetchData={fetchData} saving={saving} setSaving={setSaving} readiness={readiness} />;
};

export default Departments;
