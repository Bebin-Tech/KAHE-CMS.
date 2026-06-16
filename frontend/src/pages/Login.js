import React, { useState } from 'react';
import API from '../api';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const navigate = useNavigate();

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

            const response = await API.post('/login', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            localStorage.setItem('token', response.data.access_token);
            localStorage.setItem('role', response.data.role);
            localStorage.setItem('user_id', response.data.user_id);
            localStorage.setItem('name', response.data.name);

            navigate('/');
            window.location.reload();
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid credentials');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f0f7ff] font-sans px-4">
            <div className="max-w-[440px] w-full bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] p-8 md:p-14 flex flex-col items-center">

                {/* Institutional Logo */}
                <div className="mb-6 flex justify-center">
                    <img
                        src="/logo.svg"
                        alt="KAHE Logo"
                        className="w-[120px] h-[120px] object-contain"
                    />
                </div>

                {/* Title Section */}
                <h2 className="text-3xl font-black text-[#0072bc] tracking-tight mb-1">
                    KAHE CMS
                </h2>
                <p className="text-slate-400 font-medium text-sm mb-10">
                    Sign in to your account
                </p>

                {error && (
                    <div className="w-full mb-6 p-3 bg-red-50 border border-red-100 rounded-lg text-center">
                        <p className="text-[11px] text-red-600 font-bold uppercase">{error}</p>
                    </div>
                )}

                <form onSubmit={handleLogin} className="w-full space-y-6">
                    {/* Username Field */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            className={`w-full pl-11 pr-4 py-3 bg-white border ${emailError ? 'border-red-400' : 'border-slate-300'} rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-slate-700 placeholder:text-slate-300`}
                            placeholder="Username"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setEmailError(false); }}
                        />
                        {emailError && <p className="text-[11px] text-red-500 mt-1.5 ml-1">Please enter your email</p>}
                    </div>

                    {/* Password Field */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            className={`w-full pl-11 pr-12 py-3 bg-white border ${passwordError ? 'border-red-400' : 'border-slate-300'} rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-slate-700 placeholder:text-slate-300`}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition"
                        >
                            {showPassword ? (
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                            ) : (
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            )}
                        </button>
                        {passwordError && <p className="text-[11px] text-red-500 mt-1.5 ml-1">Please enter your password</p>}
                    </div>

                    {/* Sign In Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[#0072bc] text-white py-3.5 rounded-lg font-bold text-lg hover:bg-[#005a96] transition-all disabled:opacity-50 mt-4 active:scale-[0.98] shadow-md shadow-blue-100"
                    >
                        {isLoading ? "Authenticating..." : "Sign In"}
                    </button>
                </form>

                {/* Footer Version */}
                <div className="mt-14 text-center">
                    <p className="text-xs text-slate-300 font-medium">
                        Beta V 2.5.1
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
