import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthService } from '../../services/auth';
import { SettingsProvider } from '../../contexts/SettingsContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const location = useLocation();

    useEffect(() => {
        console.log("ProtectedRoute: Mounted");
        let mounted = true;

        const verifyAuth = async () => {
            console.log("ProtectedRoute: Checking auth...");
            const valid = AuthService.isAuthenticated();
            console.log("ProtectedRoute: AuthService.isAuthenticated() returned", valid);

            if (mounted) {
                setIsAuthenticated(valid);
            }
        };

        verifyAuth();

        return () => {
            mounted = false;
        };
    }, []);

    if (isAuthenticated === null) {
        // Loading state
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return (
        <SettingsProvider>
            {children}
        </SettingsProvider>
    );
};
