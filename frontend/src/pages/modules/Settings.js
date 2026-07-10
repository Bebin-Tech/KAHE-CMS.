import React, { useState } from 'react';
import API from '../../api';
import { authGet, authSet } from '../../authSession';
import { KeyRound, User } from 'lucide-react';

const Settings = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const username = authGet('username') || '';
    const role = authGet('role')?.toLowerCase() || 'user';
    const accountLabel = role === 'faculty' ? 'Faculty' : role === 'student' ? 'Student' : 'User';
    const sessionPassword = authGet('session_password') || 'Password is hidden until your next login or reset.';

    const handleReset = async (e) => {
        e.preventDefault();
        setMessage('');
        if (!password || password !== confirmPassword) {
            setMessage('Passwords do not match.');
            return;
        }

        setSaving(true);
        try {
            await API.post('/account/reset-password/', { password });
            authSet('session_password', password);
            setPassword('');
            setConfirmPassword('');
            setMessage('Password updated successfully.');
        } catch (err) {
            setMessage(err.response?.data?.detail || 'Password reset failed.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Settings</h1>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-2">{accountLabel} account access</p>
            </header>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-md p-8 grid gap-6 md:grid-cols-2">
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
                    <User className="text-indigo-600 mb-4" size={24} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Username</p>
                    <p className="text-lg font-black text-slate-900 mt-2 break-all">{username}</p>
                </div>
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
                    <KeyRound className="text-emerald-600 mb-4" size={24} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Password</p>
                    <p className="text-lg font-black text-slate-900 mt-2 break-all">{sessionPassword}</p>
                </div>
            </section>

            <form onSubmit={handleReset} className="bg-white rounded-2xl border border-slate-200 shadow-md p-8 space-y-5">
                <h2 className="text-lg font-black text-slate-900 uppercase">Reset Password</h2>
                <p className="text-sm font-semibold text-slate-500">Change your account password using the fields below.</p>
                {message && <div className="p-4 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black uppercase">{message}</div>}
                <div className="grid gap-5 md:grid-cols-2">
                    <input type="password" className="p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} />
                    <input type="password" className="p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
                <button disabled={saving} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50">
                    {saving ? 'Updating...' : 'Update Password'}
                </button>
            </form>
        </div>
    );
};

export default Settings;
