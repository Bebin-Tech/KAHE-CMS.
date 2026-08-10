import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import API from '../api';
import { authGet } from '../authSession';

const RegistryContext = createContext();

export const RegistryProvider = ({ children }) => {
    const [datasets, setDatasets] = useState({
        departments: [], programs: [], semesters: [], sections: [], subjects: [],
        users: [], mappings: [], curricula: [], rooms: [], settings: null,
        dashboard_stats: {}
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        const role = authGet('role')?.toLowerCase();
        const canReadUsers = ['admin', 'super_admin'].includes(role);
        try {
            const results = await Promise.allSettled([
                API.get('/departments/'),
                API.get('/subjects/'),
                canReadUsers ? API.get('/users_list/') : Promise.resolve({ data: [] }),
                API.get('/rooms/'),
                API.get('/dashboard-stats/')
            ]);

            const d = results.map(r => r.status === 'fulfilled' ? r.value.data : []);

            setDatasets(prev => ({
                ...prev,
                departments: d[0] || [],
                subjects: d[1] || [],
                users: d[2] || [],
                rooms: d[3] || [],
                dashboard_stats: d[4] || {}
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
