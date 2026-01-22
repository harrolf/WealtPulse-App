import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AuthService } from '@/services/auth';
import api from '../services/api';
import { toast } from '@/services/toast';
import { Lock, Mail, Fingerprint, Chrome } from 'lucide-react';
import axios from 'axios';
import type { ApiErrorResponse } from '../types/api';
import logoLarge from '@/assets/logo-large.svg';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [authProviders, setAuthProviders] = useState<Record<string, boolean>>({});

    useEffect(() => {
        // Initialize CSRF token by making a safe GET request
        api.get('/health').catch(() => {
            // Ignore errors here, we just want the Set-Cookie header
        });

        // Fetch enabled auth providers
        api.get('/system/config/auth_providers').then(res => {
            setAuthProviders(res.data.value || {});
        }).catch(() => {
            // Fallback to all disabled
            setAuthProviders({});
        });
    }, []);

    const from = location.state?.from?.pathname || '/';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await AuthService.login({ username: email, password });
            navigate(from, { replace: true });
        } catch (err: unknown) {
            if (axios.isAxiosError<ApiErrorResponse>(err)) {
                const detail = err.response?.data?.detail;
                if (typeof detail === 'string') {
                    setError(detail);
                } else if (Array.isArray(detail)) {
                    setError(detail.map(e => e.msg).join(', ') || 'Validation error');
                } else {
                    setError('Login failed. Please check your credentials.');
                }
            } else {
                setError('An unexpected error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOAuth = async (provider: string) => {
        try {
            const data = await AuthService.getOAuthUrl(provider);
            window.location.href = data.url;
        } catch {
            setError(`Failed to initiate ${provider} login.`);
        }
    };

    const handlePasskey = async () => {
        // Placeholder for passkey login flow (authentication vs registration)
        // Implementation would call AuthService.loginWithPasskey()
        toast.info("Passkey login coming soon!");
    };

    const hasAnyOAuth = authProviders.google || authProviders.facebook || authProviders.linkedin || authProviders.apple;

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px]"></div>
            </div>

            <div className="flex flex-col items-center justify-center mb-8 z-10 relative font-sans">
                <img src={logoLarge} alt="WealthPulse" className="w-20 h-20 mb-4" />
                <h1 className="text-4xl font-bold text-foreground m-0 tracking-tight">
                    WealthPulse
                </h1>
                <p className="mt-2 text-lg font-normal text-muted-foreground">
                    Your complete financial portfolio.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 relative">
                <div className="py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-border bg-card/50 backdrop-blur-xl">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-foreground">
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
                                    className="appearance-none block w-full px-3 py-2 pl-10 border border-input rounded-md shadow-sm placeholder-muted-foreground bg-background text-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-foreground">
                                Password
                            </label>
                            <div className="mt-1 relative">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 pl-10 border border-input rounded-md shadow-sm placeholder-muted-foreground bg-background text-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-muted-foreground" />
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
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Signing in...' : 'Sign in'}
                            </button>
                        </div>
                    </form>

                    {(hasAnyOAuth || authProviders.passkey) && (
                        <div className="mt-6">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-transparent text-muted-foreground backdrop-blur-xl bg-background/50">
                                        Or continue with
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-3 gap-3">
                                {authProviders.google && (
                                    <div>
                                        <button
                                            onClick={() => handleOAuth('google')}
                                            className="w-full inline-flex justify-center py-2 px-4 border border-border rounded-md shadow-sm bg-secondary text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                        >
                                            <span className="sr-only">Sign in with Google</span>
                                            <Chrome className="h-5 w-5" />
                                        </button>
                                    </div>
                                )}

                                {authProviders.apple && (
                                    <div>
                                        <button
                                            onClick={() => handleOAuth('apple')}
                                            className="w-full inline-flex justify-center py-2 px-4 border border-border rounded-md shadow-sm bg-secondary text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                        >
                                            <span className="sr-only">Sign in with Apple</span>
                                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                                            </svg>
                                        </button>
                                    </div>
                                )}

                                {authProviders.linkedin && (
                                    <div>
                                        <button
                                            onClick={() => handleOAuth('linkedin')}
                                            className="w-full inline-flex justify-center py-2 px-4 border border-border rounded-md shadow-sm bg-secondary text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                        >
                                            <span className="sr-only">Sign in with LinkedIn</span>
                                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {authProviders.passkey && (
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={handlePasskey}
                                        className="w-full inline-flex justify-center items-center py-2 px-4 border border-border rounded-md shadow-sm bg-secondary/50 text-sm font-medium text-primary hover:bg-secondary border-primary/20 transition-colors"
                                    >
                                        <Fingerprint className="h-5 w-5 mr-2" />
                                        Sign in with Passkey
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-6 text-center">
                        <Link to="/register" className="text-sm font-medium text-primary hover:text-primary/80">
                            Don't have an account? Sign up
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
