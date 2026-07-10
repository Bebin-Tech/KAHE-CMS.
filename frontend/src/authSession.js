const AUTH_KEYS = [
    'token',
    'access_token',
    'role',
    'user_id',
    'username',
    'name',
    'classroom_permission',
    'department_id',
    'department_name',
    'session_password'
];

const LOGGED_OUT_KEY = 'auth_logged_out';

export const authGet = (key) => {
    if (sessionStorage.getItem(LOGGED_OUT_KEY) === 'true') return null;
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue !== null) return sessionValue;
    return localStorage.getItem(key);
};

export const authSet = (key, value) => {
    sessionStorage.removeItem(LOGGED_OUT_KEY);
    sessionStorage.setItem(key, value ?? '');
};

export const authClear = () => {
    AUTH_KEYS.forEach((key) => sessionStorage.removeItem(key));
    sessionStorage.setItem(LOGGED_OUT_KEY, 'true');
};

export const saveAuthSession = (data, password, usernameFallback) => {
    sessionStorage.removeItem(LOGGED_OUT_KEY);
    const values = {
        token: data.access_token,
        role: data.role,
        user_id: data.user_id,
        username: data.username || usernameFallback,
        name: data.name,
        classroom_permission: data.classroom_permission || 'view_only',
        department_id: data.department_id || '',
        department_name: data.department_name || '',
        session_password: password
    };

    Object.entries(values).forEach(([key, value]) => {
        authSet(key, value);
        localStorage.setItem(key, value ?? '');
    });
};
