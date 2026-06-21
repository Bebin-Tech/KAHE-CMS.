import React from 'react';
import RegistryPage from '../../components/RegistryPage';
import { useRegistry } from '../../context/RegistryContext';

const FacultyMapping = () => {
    const { datasets, lookups, fetchData, saving, setSaving, readiness } = useRegistry();
    const config = {
        title: 'Resource Allocation', endpoint: '/faculty-assignments/',
        columns: [['faculty', 'Faculty'], ['subject', 'Subject'], ['section', 'Section']],
        fields: [
            { key: 'faculty', label: 'Faculty Expert', type: 'select', options: (datasets.users || []).filter(u => u.role === 'faculty').map(f => [f.id, f.full_name]), required: true },
            { key: 'subject', label: 'Target Subject', type: 'select', options: (datasets.subjects || []).map(s => [s.id, s.name]), required: true },
            { key: 'section', label: 'Academic Section', type: 'select', options: (datasets.sections || []).map(s => [s.id, lookups.section(s.id)]), required: true }
        ],
        display: { faculty: lookups.faculty, subject: lookups.subject, section: lookups.section }
    };
    return <RegistryPage moduleKey="mappings" config={config} datasets={datasets} lookups={lookups} fetchData={fetchData} saving={saving} setSaving={setSaving} readiness={readiness} />;
};

export default FacultyMapping;
