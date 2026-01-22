import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthService } from '../services/auth';

export const OAuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const { provider } = useParams<{ provider: string }>();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code');
            const state = searchParams.get('state');

            if (!code || !provider) {
                setError('Invalid callback parameters');
                return;
            }

            try {
                await AuthService.handleOAuthCallback(provider, code, state || '');
                navigate('/', { replace: true });
            } catch (err) {
                console.error("OAuth Error", err);
                setError('Authentication failed. Please try again.');
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            }
        };

        handleCallback();
    }, [provider, searchParams, navigate]);

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                <div className="text-red-400 mb-4 text-xl font-bold">Authentication Failed</div>
                <div className="text-slate-400">{error}</div>
                <div className="text-slate-500 mt-2 text-sm">Redirecting to login...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <div className="text-slate-300">Completing {provider} sign in...</div>
        </div>
    );
};
