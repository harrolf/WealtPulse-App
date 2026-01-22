import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Assets } from '@/pages/Assets';
import { Dashboard } from '@/pages/Dashboard';
import { Settings } from '@/pages/Settings';
import { Custodians } from '@/pages/Custodians';
import { AssetTypes } from '@/pages/AssetTypes';
import { GroupsTags } from '@/pages/GroupsTags';
import { Currencies } from '@/pages/Currencies';
import { Admin } from '@/pages/Admin';


// Initialize QueryClient
const queryClient = new QueryClient();



import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { OAuthCallback } from '@/pages/OAuthCallback';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/ui/Toast';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContainer />
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback/:provider" element={<OAuthCallback />} />

            {/* Protected Routes */}
            <Route element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route path="/" element={<Dashboard />} />
              <Route path="/assets" element={<Assets />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/custodians" element={<Custodians />} />
              <Route path="/asset-types" element={<AssetTypes />} />
              <Route path="/groups-tags" element={<GroupsTags />} />
              <Route path="/currencies" element={<Currencies />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
