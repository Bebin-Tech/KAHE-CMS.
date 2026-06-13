import axios from 'axios';

// Detect if we are running locally to help with local development
const isLocal = window.location.hostname === 'localhost';
const defaultBaseURL = isLocal ? 'http://localhost:8000' : '';

const API = axios.create({
    baseURL: (process.env.REACT_APP_API_URL || defaultBaseURL) + '/api',
});

API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

API.interceptors.response.use(
    (response) => response,
    (error) => {
        // Only redirect on 401 if it's NOT the login request itself
        // to prevent loops or hiding the login error message
        const isLoginRequest = error.config.url.includes('/login');

        if (error.response && error.response.status === 401 && !isLoginRequest) {
            localStorage.clear();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default API;
