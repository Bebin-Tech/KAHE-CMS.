import React from 'react';
import RegistryPage from '../../components/RegistryPage';
import { useRegistry } from '../../context/RegistryContext';
import { Lock, RefreshCw } from 'lucide-react';

const UserManagement = () => {
    const { datasets, lookups, fetchData, saving, setSaving } = useRegistry();
    const config = {
        title: 'System User Registry', endpoint: '/users/',
        columns: [['username', 'Username'], ['full_name', 'Name'], ['department_name', 'Dept'], ['role', 'Role'], ['status', 'Status']],
        fields: [
            { key: 'first_name', label: 'Full Name', required: true },
            { key: 'username', label: 'Username', required: true },
            { key: 'role', label: 'System Role', type: 'select', options: [['faculty', 'Faculty'], ['hod', 'HOD'], ['staff', 'Staff'], ['admin', 'Admin'], ['super_admin', 'Super Admin']], required: true },
            { key: 'department', label: 'Primary Department', type: 'select', options: (datasets.departments || []).map(d => [d.id, d.name]), required: true },
            { key: 'password', label: 'Secure Password', type: 'password', required: true },
            { key: 'confirm_password', label: 'Confirm Password', type: 'password', required: true },
            { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
        ],
        actions: [
            { label: 'Reset PWD', icon: Lock, color: 'text-amber-500', type: 'RESET_PWD' },
            { label: 'Toggle Status', icon: RefreshCw, color: 'text-blue-500', type: 'TOGGLE_STATUS' }
        ]
    };
    return <RegistryPage moduleKey="users" config={config} datasets={datasets} lookups={lookups} fetchData={fetchData} saving={saving} setSaving={setSaving} />;
};

export default UserManagement;
