import React from 'react';
import RegistryPage from '../../components/RegistryPage';
import { useRegistry } from '../../context/RegistryContext';

const Sections = () => {
    const { datasets, lookups, fetchData, saving, setSaving } = useRegistry();
    const config = {
        title: 'Section Registry', endpoint: '/sections/',
        columns: [['name', 'Section'], ['semester', 'Semester'], ['student_count', 'Strength'], ['status', 'Status']],
        fields: [
            { key: 'name', label: 'Section Name', required: true, placeholder: 'e.g. A' },
            { key: 'semester', label: 'Semester', type: 'select', options: (datasets.semesters || []).map(s => [s.id, lookups.semester(s.id)]), required: true },
            { key: 'student_count', label: 'Student Strength', type: 'number', required: true },
            { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
        ],
        display: { semester: lookups.semester }
    };
    return <RegistryPage moduleKey="sections" config={config} datasets={datasets} lookups={lookups} fetchData={fetchData} saving={saving} setSaving={setSaving} />;
};

export default Sections;
