import axios from 'axios';

// Comprehensive URL detection for development and production
const getBaseURL = () => {
    // 1. If explicit env var exists, use it
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;

    // 2. If running on React Dev Server (port 3000), point to FastAPI (port 8000)
    if (window.location.port === '3000') {
        return `http://${window.location.hostname}:8000/api`;
    }

    // 3. In production (Render/Docker), use relative paths
    return '/api';
};

const API = axios.create({
    baseURL: getBaseURL(),
});

API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        // Django REST Framework TokenAuthentication expects 'Token' prefix
        config.headers.Authorization = `Token ${token}`;
    }
    return config;
});

API.interceptors.response.use(
    (response) => response,
    (error) => {
        // Log all API errors to help with debugging 404s
        console.error(`Institutional Gateway Error [${error.response?.status || 'Network'}]:`, {
            url: error.config?.url,
            method: error.config?.method,
            baseURL: error.config?.baseURL,
            data: error.response?.data
        });

        const isLoginRequest = error.config?.url?.includes('/login');
        if (error.response && error.response.status === 401 && !isLoginRequest) {
            localStorage.clear();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default API;
