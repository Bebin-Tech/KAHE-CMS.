import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import API from '../api';

const RegistryContext = createContext();

export const RegistryProvider = ({ children }) => {
    const [datasets, setDatasets] = useState({
        departments: [], programs: [], semesters: [], sections: [], subjects: [],
        users: [], mappings: [], curricula: [], rooms: [], settings: null,
        audit: [], dashboard_stats: {}
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const results = await Promise.allSettled([
                API.get('/departments/'), API.get('/programs/'), API.get('/semesters/'),
                API.get('/sections/'), API.get('/subjects/'), API.get('/users_list/'),
                API.get('/faculty-assignments/'), API.get('/curricula/'),
                API.get('/rooms/'), API.get('/dashboard-stats/'), API.get('/audit-logs/')
            ]);

            const d = results.map(r => r.status === 'fulfilled' ? r.value.data : []);

            setDatasets(prev => ({
                ...prev,
                departments: d[0] || [], programs: d[1] || [], semesters: d[2] || [],
                sections: d[3] || [], subjects: d[4] || [], users: d[5] || [],
                mappings: d[6] || [], curricula: d[7] || [], rooms: d[8] || [],
                dashboard_stats: d[9] || {},
                audit: d[10] || []
            }));
        } catch (err) {
            console.error("Registry Sync Failure");
        } finally {
            setLoading(false);
        }
    }, []);

    const lookups = useMemo(() => ({
        department: id => (datasets.departments || []).find(i => i.id === Number(id))?.name || '-',
        program: id => (datasets.programs || []).find(i => i.id === Number(id))?.name || '-',
        semester: id => {
            const sem = (datasets.semesters || []).find(i => i.id === Number(id));
            if (!sem) return '-';
            const prog = (datasets.programs || []).find(p => p.id === sem.program_id)?.name || '';
            return `Sem ${sem.number} ${prog ? `(${prog})` : ''}`;
        },
        section: id => (datasets.sections || []).find(i => i.id === Number(id))?.name || '-',
        faculty: id => (datasets.users || []).find(i => i.id === Number(id))?.full_name || '-',
        subject: id => (datasets.subjects || []).find(i => i.id === Number(id))?.name || '-'
    }), [datasets]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <RegistryContext.Provider value={{ datasets, loading, saving, setSaving, lookups, fetchData }}>
            {children}
        </RegistryContext.Provider>
    );
};

export const useRegistry = () => useContext(RegistryContext);
