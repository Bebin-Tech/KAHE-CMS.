import React from 'react';
import RegistryPage from '../../components/RegistryPage';
import { useRegistry } from '../../context/RegistryContext';

const CurriculumMap = () => {
    const { datasets, lookups, fetchData, saving, setSaving } = useRegistry();
    const config = {
        title: 'Workload Parameters', endpoint: '/curricula/',
        columns: [['semester', 'Semester'], ['subject', 'Subject'], ['weekly_hours', 'Hrs/Wk']],
        fields: [
            { key: 'department', label: 'Department', type: 'select', options: (datasets.departments || []).map(d => [d.id, d.name]), required: true },
            { key: 'program', label: 'Program', type: 'select', options: (datasets.programs || []).map(p => [p.id, p.name]), required: true },
            { key: 'semester', label: 'Semester', type: 'select', options: (datasets.semesters || []).map(s => [s.id, lookups.semester(s.id)]), required: true },
            { key: 'subject', label: 'Subject', type: 'select', options: (datasets.subjects || []).map(s => [s.id, s.name]), required: true },
            { key: 'weekly_hours', label: 'Weekly Hours', type: 'number', required: true }
        ],
        display: { semester: lookups.semester, subject: lookups.subject }
    };
    return <RegistryPage moduleKey="curricula" config={config} datasets={datasets} lookups={lookups} fetchData={fetchData} saving={saving} setSaving={setSaving} />;
};

export default CurriculumMap;
