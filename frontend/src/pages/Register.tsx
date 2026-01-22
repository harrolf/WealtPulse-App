import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthService } from '../services/auth';
import api from '../services/api';
import { Lock, Mail, User } from 'lucide-react';
import axios from 'axios';
import type { ApiErrorResponse } from '../types/api';

export const Register: React.FC = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Initialize CSRF token by making a safe GET request
        api.get('/health').catch(() => { });
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await AuthService.register({ name, email, password });
            // Use login flow immediately or redirect to login? 
            // AuthService.register returns user, we can then login automatically or ask them to login.
            // For smooth UX, let's login automatically.
            await AuthService.login({ username: email, password });
            navigate('/');
        } catch (err: unknown) {
            if (axios.isAxiosError<ApiErrorResponse>(err)) {
                const detail = err.response?.data?.detail;
                if (typeof detail === 'string') {
                    setError(detail);
                } else if (Array.isArray(detail)) {
                    setError(detail.map(e => e.msg).join(', ') || 'Validation error');
                } else {
                    setError('Registration failed.');
                }
            } else {
                setError('An unexpected error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[20%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]"></div>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 relative">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
                    Create Account
                </h2>
                <p className="mt-2 text-center text-sm text-slate-400">
                    Join WealthPulse
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 relative">
                <div className="glass-card py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-white/10 bg-white/5 backdrop-blur-xl">
                    <form className="space-y-6" onSubmit={handleRegister}>
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-300">
                                Full Name
                            </label>
                            <div className="mt-1 relative">
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 pl-10 border border-slate-700 rounded-md shadow-sm placeholder-slate-500 bg-slate-900/50 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-slate-500" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                                Email address
                            </label>
                            <div className="mt-1 relative">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 pl-10 border border-slate-700 rounded-md shadow-sm placeholder-slate-500 bg-slate-900/50 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-500" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                                Password
                            </label>
                            <div className="mt-1 relative">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 pl-10 border border-slate-700 rounded-md shadow-sm placeholder-slate-500 bg-slate-900/50 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-500" />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-md bg-red-500/10 p-4 border border-red-500/20">
                                <div className="flex">
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-400">{error}</h3>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Creating account...' : 'Create Account'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 text-center">
                        <Link to="/login" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
                            Already have an account? Sign in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
