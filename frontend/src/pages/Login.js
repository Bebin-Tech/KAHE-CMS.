import React, { useState } from 'react';
import API from '../api';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('username', email);
            formData.append('password', password);

            const response = await API.post('/login', formData);
            localStorage.setItem('token', response.data.access_token);
            localStorage.setItem('role', response.data.role);
            localStorage.setItem('user_id', response.data.user_id);
            localStorage.setItem('name', response.data.name);

            navigate('/');
            window.location.reload();
        } catch (err) {
            console.error("Login error:", err);
            setError(err.response?.data?.detail || 'Invalid institutional credentials. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-500">
                <div className="text-center">
                    <div className="flex justify-center mb-6">
                        <img
                            src="/logo.svg"
                            alt="KAHE Logo"
                            className="w-[140px] h-[140px] object-contain drop-shadow-sm"
                        />
                    </div>
                    <h2 className="text-4xl font-black text-[#1e1b4b] tracking-tight mb-2">
                        KAHE CMS
                    </h2>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">
                        Institutional Portal Access
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl animate-shake">
                        <p className="text-xs text-red-600 font-bold text-center">{error}</p>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleLogin} autoComplete="off">
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <input
                                type="email"
                                name="email_field"
                                required
                                className="w-full p-4 bg-slate-50 border border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700 outline-none"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password_field"
                                    required
                                    className="w-full p-4 bg-slate-50 border border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700 outline-none pr-12"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition"
                                >
                                    {showPassword ? (
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                        </svg>
                                    ) : (
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-1">
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 transition cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600 transition">Keep me signed in</span>
                        </label>

                        <button type="button" className="text-xs font-black text-indigo-600 hover:text-indigo-700 transition uppercase tracking-wider">
                            Reset Access
                        </button>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full flex justify-center py-5 px-4 border border-transparent text-sm font-black rounded-2xl text-white transition-all transform active:scale-95 shadow-xl uppercase tracking-widest ${
                                isLoading
                                ? 'bg-slate-400 cursor-not-allowed'
                                : 'bg-[#1e1b4b] hover:bg-[#1a1744] hover:shadow-indigo-100 shadow-indigo-50'
                            }`}
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                "Sign In to Portal"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
