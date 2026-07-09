import React, { useState } from 'react';
import API from '../api';

const Login = () => {
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setEmailError(!email.trim());
        setPasswordError(!password);

        if (!email.trim() || !password) return;

        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('username', email.trim());
            params.append('password', password);

            const response = await API.post('/login/', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            localStorage.setItem('token', response.data.access_token);
            localStorage.setItem('role', response.data.role);
            localStorage.setItem('user_id', response.data.user_id);
            localStorage.setItem('username', response.data.username || email.trim());
            localStorage.setItem('name', response.data.name);
            localStorage.setItem('classroom_permission', response.data.classroom_permission || 'view_only');
            localStorage.setItem('department_id', response.data.department_id || '');
            localStorage.setItem('department_name', response.data.department_name || '');
            localStorage.setItem('session_password', password);

            // Redirect to home page using navigate instead of full reload to prevent blinking
            window.location.replace('/');
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid credentials');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        if (!fullName.trim() || !email.trim() || !password || password !== confirmPassword) {
            setError('Enter your name, username, and matching passwords.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await API.post('/register-student/', {
                full_name: fullName.trim(),
                username: email.trim(),
                password
            });

            localStorage.setItem('token', response.data.access_token);
            localStorage.setItem('role', response.data.role);
            localStorage.setItem('user_id', response.data.user_id);
            localStorage.setItem('username', response.data.username || email.trim());
            localStorage.setItem('name', response.data.name);
            localStorage.setItem('classroom_permission', response.data.classroom_permission || 'view_only');
            localStorage.setItem('department_id', response.data.department_id || '');
            localStorage.setItem('department_name', response.data.department_name || '');
            localStorage.setItem('session_password', password);
            window.location.replace('/classroom-tracking');
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-screen overflow-hidden flex items-center justify-center bg-[#f0f7ff] font-sans px-4 py-4">
            <div className="max-w-[430px] w-full max-h-full bg-white rounded-2xl border border-slate-200 shadow-[0_12px_45px_rgba(15,23,42,0.14)] px-8 py-7 md:px-11 md:py-9 flex flex-col items-center">

                {/* Institutional Logo */}
                <div className="mb-4 flex justify-center">
                    <img
                        src="/logo.svg"
                        alt="KAHE Logo"
                        className="w-[96px] h-[96px] object-contain"
                    />
                </div>

                {/* Title Section */}
                <h2 className="text-[28px] font-black text-[#0072bc] tracking-tight mb-1">
                    KAHE CMS
                </h2>
                <p className="text-slate-600 font-semibold text-sm mb-6">
                    {mode === 'login' ? 'Sign in to your account' : 'Create your student account'}
                </p>

                {error && (
                    <div className="w-full mb-4 p-2.5 bg-red-50 border border-red-100 rounded-lg text-center">
                        <p className="text-[10px] text-red-600 font-bold uppercase">{error}</p>
                    </div>
                )}

                {mode === 'register' && (
                    <form onSubmit={handleRegister} className="w-full space-y-4">
                        <input
                            type="text"
                            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm text-slate-800 placeholder:text-slate-500"
                            placeholder="Full Name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                        <input
                            type="text"
                            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm text-slate-800 placeholder:text-slate-500"
                            placeholder="Create Username"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <input
                            type="password"
                            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm text-slate-800 placeholder:text-slate-500"
                            placeholder="Create Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <input
                            type="password"
                            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm text-slate-800 placeholder:text-slate-500"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#0072bc] text-white py-3 rounded-lg font-bold text-base hover:bg-[#005a96] transition-all disabled:opacity-50 active:scale-[0.98] shadow-md shadow-blue-100"
                        >
                            {isLoading ? "Creating..." : "Create Account"}
                        </button>
                    </form>
                )}

                {mode === 'login' && <form onSubmit={handleLogin} className="w-full space-y-5">
                    {/* Username Field */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            className={`w-full pl-11 pr-4 py-3 bg-white border ${emailError ? 'border-red-400' : 'border-slate-300'} rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm text-slate-800 placeholder:text-slate-500`}
                            placeholder="Username"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setEmailError(false); }}
                        />
                        {emailError && <p className="text-[10px] text-red-500 mt-1 ml-1">Please enter your username</p>}
                    </div>

                    {/* Password Field */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            className={`w-full pl-11 pr-12 py-3 bg-white border ${passwordError ? 'border-red-400' : 'border-slate-300'} rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm text-slate-800 placeholder:text-slate-500`}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-blue-600 transition"
                        >
                            {showPassword ? (
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                            ) : (
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            )}
                        </button>
                        {passwordError && <p className="text-[10px] text-red-500 mt-1 ml-1">Please enter your password</p>}
                    </div>

                    {/* Sign In Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[#0072bc] text-white py-3 rounded-lg font-bold text-base hover:bg-[#005a96] transition-all disabled:opacity-50 active:scale-[0.98] shadow-md shadow-blue-100"
                    >
                        {isLoading ? "Authenticating..." : "Sign In"}
                    </button>
                </form>}

                <button
                    type="button"
                    onClick={() => {
                        setMode(mode === 'login' ? 'register' : 'login');
                        setError('');
                        setPassword('');
                        setConfirmPassword('');
                    }}
                    className="mt-5 text-[11px] font-black uppercase tracking-widest text-[#0072bc] hover:text-[#005a96]"
                >
                    {mode === 'login' ? 'Create New Account' : 'Back to Login'}
                </button>

                {/* Footer Version */}
                <div className="mt-6 text-center">
                    <p className="text-[11px] text-slate-500 font-medium">
                        Beta V 2.5.1
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
