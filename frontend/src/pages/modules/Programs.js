import React from 'react';
import RegistryPage from '../../components/RegistryPage';
import { useRegistry } from '../../context/RegistryContext';

const Programs = () => {
    const { datasets, lookups, fetchData, saving, setSaving } = useRegistry();
    const config = {
        title: 'Program Management', endpoint: '/programs/',
        columns: [['code', 'Code'], ['name', 'Name'], ['department', 'Department'], ['duration_years', 'Years'], ['status', 'Status']],
        fields: [
            { key: 'code', label: 'Program Code', required: true },
            { key: 'name', label: 'Program Name', required: true },
            { key: 'department', label: 'Department', type: 'select', options: (datasets.departments || []).map(d => [d.id, d.name]), required: true },
            { key: 'duration_years', label: 'Duration (Years)', type: 'number', required: true },
            { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
        ],
        display: { department: lookups.department }
    };
    return <RegistryPage moduleKey="programs" config={config} datasets={datasets} lookups={lookups} fetchData={fetchData} saving={saving} setSaving={setSaving} />;
};

export default Programs;
