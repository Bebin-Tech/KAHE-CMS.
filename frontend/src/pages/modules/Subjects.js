import React from 'react';
import RegistryPage from '../../components/RegistryPage';
import { useRegistry } from '../../context/RegistryContext';

const Subjects = () => {
    const { datasets, lookups, fetchData, saving, setSaving, readiness } = useRegistry();
    const config = {
        title: 'Subject Curriculum', endpoint: '/subjects/',
        columns: [['code', 'Code'], ['name', 'Subject'], ['mne', 'MNE'], ['weekly_hours', 'Hrs/Wk'], ['status', 'Status']],
        fields: [
            { key: 'code', label: 'Subject Code', required: true },
            { key: 'name', label: 'Subject Name', required: true },
            { key: 'mne', label: 'MNE (Abbreviation)', placeholder: 'e.g. PYTH' },
            { key: 'type', label: 'Type', type: 'select', options: ['Theory', 'Lab'], required: true },
            { key: 'credits', label: 'Credits', type: 'number', required: true },
            { key: 'syllabus_hours', label: 'Periods (Syllabus)', type: 'number' },
            { key: 'allotted_hours', label: 'Periods (Allotted)', type: 'number' },
            { key: 'weekly_hours', label: 'Weekly Target Hours', type: 'number', required: true },
            { key: 'department', label: 'Department', type: 'select', options: (datasets.departments || []).map(d => [d.id, d.name]), required: true },
            { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
        ]
    };
    return <RegistryPage moduleKey="subjects" config={config} datasets={datasets} lookups={lookups} fetchData={fetchData} saving={saving} setSaving={setSaving} readiness={readiness} />;
};

export default Subjects;
