import React, { useCallback, useEffect, useState } from 'react';
import RegistryPage from '../../components/RegistryPage';
import { useRegistry } from '../../context/RegistryContext';
import { Lock, RefreshCw } from 'lucide-react';
import API from '../../api';

const UserManagement = () => {
    const { datasets, lookups, fetchData, saving, setSaving } = useRegistry();
    const [activePage, setActivePage] = useState('faculty');
    const [users, setUsers] = useState([]);
    const [userPage, setUserPage] = useState(1);
    const [userSearch, setUserSearch] = useState('');
    const [userMeta, setUserMeta] = useState({ count: 0, total_pages: 1 });

    const pages = [
        { key: 'faculty', label: 'Page 1: Faculty', role: 'faculty', createLabel: '+ Create Faculty Login' },
        { key: 'admin', label: 'Page 2: Admin', role: 'admin', createLabel: '+ Create Admin Login' },
        { key: 'student', label: 'Page 3: Newly Registered Students', role: 'student', createLabel: '+ Add Student' }
    ];
    const currentPage = pages.find(p => p.key === activePage) || pages[0];
    const permissionOptions = currentPage.key === 'faculty'
        ? [['class_session', 'Start / End Class'], ['view_only', 'View Only']]
        : currentPage.key === 'admin'
            ? [['manage_classrooms', 'Create / Edit / Delete / Start / End'], ['class_session', 'Start / End Class'], ['view_only', 'View Only']]
            : [['view_only', 'View Only']];
    const defaultPermission = permissionOptions[0][0];
    const fetchUsers = useCallback(async (page = userPage, search = userSearch) => {
        const res = await API.get('/users_list/', {
            params: {
                role: currentPage.role,
                page,
                page_size: 25,
                search
            }
        });
        setUsers(res.data.results || []);
        setUserMeta({
            count: res.data.count || 0,
            total_pages: res.data.total_pages || 1
        });
        setUserPage(res.data.page || page);
    }, [currentPage.role, userPage, userSearch]);

    useEffect(() => {
        setUserPage(1);
        setUserSearch('');
    }, [activePage]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers(userPage, userSearch);
        }, 250);
        return () => clearTimeout(timer);
    }, [fetchUsers, userPage, userSearch]);

    const config = {
        title: currentPage.label, endpoint: '/users/',
        rows: users,
        allowBulkImport: false,
        serverPagination: true,
        currentPage: userPage,
        totalPages: userMeta.total_pages,
        totalRecords: userMeta.count,
        searchTerm: userSearch,
        onSearchChange: value => {
            setUserSearch(value);
            setUserPage(1);
        },
        onPageChange: page => setUserPage(page),
        onSaved: () => fetchUsers(userPage, userSearch),
        createLabel: currentPage.createLabel,
        defaultValues: { role: currentPage.role, status: 'Active', classroom_permission: defaultPermission },
        columns: currentPage.key === 'faculty'
            ? [['username', 'User ID'], ['full_name', 'Name'], ['department', 'Department'], ['classroom_permission', 'Permission'], ['status', 'Status']]
            : [['username', 'User ID'], ['full_name', 'Name'], ['role', 'Role'], ['classroom_permission', 'Permission'], ['status', 'Status']],
        fields: [
            { key: 'first_name', label: 'Full Name', required: true },
            { key: 'username', label: 'User ID', required: true },
            { key: 'role', label: 'System Role', type: 'select', options: currentPage.key === 'admin' ? [['admin', 'Admin'], ['super_admin', 'Super Admin']] : [[currentPage.role, currentPage.role === 'student' ? 'Student' : 'Faculty']], required: true },
            ...(currentPage.key === 'faculty' ? [{ key: 'department', label: 'Department', type: 'select', options: (datasets.departments || []).map(d => [d.id, d.name]), required: true }] : []),
            { key: 'classroom_permission', label: 'Classroom Permission', type: 'select', options: permissionOptions, required: true },
            { key: 'password', label: 'Secure Password', type: 'password', required: true },
            { key: 'confirm_password', label: 'Confirm Password', type: 'password', required: true },
            { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }
        ],
        display: {
            department: (value, row) => row.department_name || lookups.department(value),
            classroom_permission: value => ({
                view_only: 'View Only',
                class_session: 'Start / End Class',
                manage_classrooms: 'Full Classroom Access'
            }[value] || 'View Only')
        },
        actions: [
            { label: 'Reset PWD', icon: Lock, color: 'text-amber-500', type: 'RESET_PWD' },
            { label: 'Toggle Status', icon: RefreshCw, color: 'text-blue-500', type: 'TOGGLE_STATUS' }
        ]
    };
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
                {pages.map(page => (
                    <button
                        key={page.key}
                        onClick={() => {
                            setActivePage(page.key);
                            setUserPage(1);
                            setUserSearch('');
                        }}
                        className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${activePage === page.key ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-700 border-slate-300 hover:text-indigo-700 hover:border-indigo-300'}`}
                    >
                        {page.label}
                    </button>
                ))}
            </div>
            <RegistryPage moduleKey="users" config={config} datasets={datasets} lookups={lookups} fetchData={fetchData} saving={saving} setSaving={setSaving} />
        </div>
    );
};

export default UserManagement;
