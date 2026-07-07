import React from 'react';
import RegistryPage from '../../components/RegistryPage';
import { useRegistry } from '../../context/RegistryContext';

const Semesters = () => {
    const { datasets, lookups, fetchData, saving, setSaving } = useRegistry();
    const config = {
        title: 'Semester Setup', endpoint: '/semesters/',
        columns: [['number', 'No'], ['program', 'Program'], ['is_active', 'Active']],
        fields: [
            { key: 'number', label: 'Semester Number', type: 'number', required: true },
            { key: 'program', label: 'Program', type: 'select', options: (datasets.programs || []).map(p => [p.id, p.name]), required: true },
            { key: 'is_active', label: 'Is Active', type: 'select', options: [[true, 'Yes'], [false, 'No']] }
        ],
        display: { program: lookups.program }
    };
    return <RegistryPage moduleKey="semesters" config={config} datasets={datasets} lookups={lookups} fetchData={fetchData} saving={saving} setSaving={setSaving} />;
};

export default Semesters;
