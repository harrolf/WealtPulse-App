import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, Search, Play, LogOut, Ban, CheckCircle, Key, Server, Activity, Database, Scroll, Trash2, Settings, LayoutGrid, Tag } from 'lucide-react';
import api, { setPortfolioUser, getPortfolioUser } from '@/services/api';
import { AuthService } from '@/services/auth';
import { UserService } from '@/services/users';
import { cn } from '@/lib/utils';
import { toast } from '@/services/toast';
import { useFormattedDateTime } from '@/utils/datetime';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import type { User } from '@/services/auth';

// Admin Components
import { SystemResources } from '@/components/admin/SystemResources';
import { ApiStatusSection } from '@/components/admin/ApiStatus';
import { BackgroundAgentsTable } from '@/components/admin/BackgroundAgents';
import { SystemConfig } from '@/components/admin/SystemConfig';
import { MarketHistoryTable } from '@/components/admin/MarketHistory';
import { SystemLogs } from '@/components/admin/SystemLogs';
import { SystemAssetTypes } from '@/components/admin/SystemAssetTypes';
import { SystemAssetCategories } from '@/components/admin/SystemAssetCategories';

export function Admin() {
    const { formatDate } = useFormattedDateTime();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const portfolioUserId = getPortfolioUser();

    // Single flattened view state
    const [activeView, setActiveView] = useState<'users' | 'system' | 'asset-types' | 'asset-categories' | 'config' | 'agents' | 'market' | 'logs'>('users');

    // Password Reset State
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<{ id: number; email: string } | null>(null);
    const [newPassword, setNewPassword] = useState('');

    // Confirmation State
    const [confirmationState, setConfirmationState] = useState<{
        type: 'activate' | 'deactivate' | 'promote' | 'demote' | 'delete',
        user: User
    } | null>(null);

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: AuthService.getCurrentUser,
    });

    // System Metrics Query - Only active on 'system' (Overview) view
    const { data: metrics } = useQuery({
        queryKey: ['system-metrics'],
        queryFn: async () => {
            const response = await api.get('/system/status');
            return response.data.resources;
        },
        enabled: activeView === 'system',
        refetchInterval: 2000
    });

    const { data: users, isLoading } = useQuery({
        queryKey: ['admin-users'],
        queryFn: () => UserService.listUsers(),
        enabled: !!currentUser?.is_admin
    });

    const updateUserMutation = useMutation({
        mutationFn: async ({ userId, data }: { userId: number; data: { is_active?: boolean; is_admin?: boolean } }) => {
            return UserService.updateUser(userId, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        }
    });

    const deleteUserMutation = useMutation({
        mutationFn: async (userId: number) => {
            return UserService.deleteUser(userId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            toast.success("User deleted successfully");
        },
        onError: (err: Error) => {
            toast.error(`Failed to delete user: ${err.message}`);
        }
    });

    const resetPasswordMutation = useMutation({
        mutationFn: async () => {
            if (!selectedUser || !newPassword) return;
            return UserService.resetPassword(selectedUser.id, newPassword);
        },
        onSuccess: () => {
            setResetModalOpen(false);
            setNewPassword('');
            setSelectedUser(null);
            toast.success("Password updated successfully");
        },
        onError: (err: Error) => {
            toast.error(`Failed to reset password: ${err.message}`);
        }
    });

    const handleSwitchContext = (userId: number) => {
        if (portfolioUserId === userId) {
            setPortfolioUser(null); // Exit context
        } else {
            setPortfolioUser(userId);
        }
    };

    const handleResetClick = (user: User) => {
        setSelectedUser(user);
        setNewPassword(''); // Clear prev
        setResetModalOpen(true);
    };

    const handleToggleActive = (user: User) => {
        if (user.id === currentUser?.id) return; // Prevent self-ban
        setConfirmationState({ type: user.is_active ? 'deactivate' : 'activate', user });
    };

    const handleToggleAdmin = (user: User) => {
        if (user.id === currentUser?.id) return; // Prevent self-demotion
        setConfirmationState({ type: user.is_admin ? 'demote' : 'promote', user });
    };

    const handleDelete = (user: User) => {
        if (user.id === currentUser?.id) return;
        setConfirmationState({ type: 'delete', user });
    };

    const handleConfirmAction = () => {
        if (!confirmationState) return;
        const { type, user } = confirmationState;

        switch (type) {
            case 'activate':
            case 'deactivate':
                updateUserMutation.mutate({ userId: user.id, data: { is_active: !user.is_active } });
                break;
            case 'promote':
            case 'demote':
                updateUserMutation.mutate({ userId: user.id, data: { is_admin: !user.is_admin } });
                break;
            case 'delete':
                deleteUserMutation.mutate(user.id);
                break;
        }
        setConfirmationState(null);
    };

    const filteredUsers = users?.filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    if (!currentUser?.is_admin) {
        return <div className="p-8 text-center text-red-500">Access Denied</div>;
    }

    const navItems = [
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'system', label: 'System Overview', icon: Activity },
        { id: 'asset-types', label: 'Asset Types', icon: LayoutGrid },
        { id: 'asset-categories', label: 'Asset Categories', icon: Tag },
        { id: 'config', label: 'Configuration', icon: Settings },
        { id: 'agents', label: 'System Agents', icon: Server },
        { id: 'logs', label: 'Global Logs', icon: Scroll },
        { id: 'market', label: 'Market Data', icon: Database },
    ] as const;

    // Helper to get confirmation text
    const getConfirmationProps = () => {
        if (!confirmationState) return { title: '', message: '' };

        switch (confirmationState.type) {
            case 'activate':
                return {
                    title: "Activate User",
                    message: `Are you sure you want to activate ${confirmationState.user.email}? They will gain access to Login.`,
                    variant: 'info' as const,
                    confirmText: "Activate"
                };
            case 'deactivate':
                return {
                    title: "Deactivate User",
                    message: `Are you sure you want to deactivate ${confirmationState.user.email}? They will lose access immediately.`,
                    variant: 'warning' as const,
                    confirmText: "Deactivate"
                };
            case 'promote':
                return {
                    title: "Grant Admin Access",
                    message: `Are you sure you want to grant Administrator privileges to ${confirmationState.user.email}?`,
                    variant: 'warning' as const,
                    confirmText: "Promote"
                };
            case 'demote':
                return {
                    title: "Revoke Admin Access",
                    message: `Are you sure you want to revoke Administrator privileges from ${confirmationState.user.email}?`,
                    variant: 'warning' as const,
                    confirmText: "Revoke"
                };
            case 'delete':
                return {
                    title: "Delete User",
                    message: `Are you sure you want to PERMANENTLY DELETE user ${confirmationState.user.email}? This action cannot be undone and will remove all their data.`,
                    variant: 'danger' as const,
                    confirmText: "Delete User"
                };
        }
    };

    const confirmProps = getConfirmationProps();

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Header */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <Shield className="h-6 w-6 text-primary" />
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Admin Dashboard</h1>
                        </div>
                        <p className="text-muted-foreground text-lg mt-1">
                            System control center.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 flex flex-col gap-2">
                    <div className="glass-card p-2 rounded-xl border border-white/10 space-y-1">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveView(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left",
                                    activeView === item.id
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-medium"
                                        : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                <span className="whitespace-nowrap">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-[500px]">
                    {activeView === 'users' && (
                        <div className="space-y-4 animate-slide-up">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    Users ({filteredUsers.length})
                                </h2>
                                <div className="relative w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="glass-strong rounded-xl border border-border/50 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gradient-to-r from-primary/5 to-accent/5 backdrop-blur-sm">
                                        <tr className="text-left text-sm font-medium text-muted-foreground border-b border-border/50">
                                            <th className="px-6 py-4">User</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Role</th>
                                            <th className="px-6 py-4">Joined</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {isLoading ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                                        ) : filteredUsers.map((user) => (
                                            <tr key={user.id} className="group hover:bg-primary/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{user.name || 'No Name'}</span>
                                                        <span className="text-xs text-muted-foreground">{user.email}</span>
                                                        <span className="text-[10px] text-muted-foreground/50 font-mono">ID: {user.id}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {user.is_active ? (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {user.is_admin && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                                            <Shield className="w-3 h-3" /> Admin
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground">
                                                    {formatDate(user.created_at)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {/* Reset Password */}
                                                        <button
                                                            onClick={() => handleResetClick(user)}
                                                            className="p-2 text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10 rounded-lg transition-colors"
                                                            title="Reset Password"
                                                        >
                                                            <Key className="w-4 h-4" />
                                                        </button>

                                                        {/* Ban/Unban */}
                                                        {user.id !== currentUser?.id && (
                                                            <button
                                                                onClick={() => handleToggleActive(user)}
                                                                className={cn(
                                                                    "p-2 rounded-lg transition-colors",
                                                                    user.is_active
                                                                        ? "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                                        : "text-red-500 hover:text-emerald-500 hover:bg-emerald-500/10"
                                                                )}
                                                                title={user.is_active ? "Deactivate User" : "Activate User"}
                                                            >
                                                                {user.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                                            </button>
                                                        )}

                                                        {/* Promote/Demote */}
                                                        <button
                                                            onClick={() => handleToggleAdmin(user)}
                                                            className={cn(
                                                                "p-2 rounded-lg transition-colors",
                                                                user.is_admin
                                                                    ? "text-purple-500 hover:text-muted-foreground hover:bg-muted"
                                                                    : "text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10"
                                                            )}
                                                            title={user.is_admin ? "Revoke Admin" : "Make Admin"}
                                                        >
                                                            <Shield className="w-4 h-4" />
                                                        </button>


                                                        {/* Delete User */}
                                                        {user.id !== currentUser?.id && (
                                                            <button
                                                                onClick={() => handleDelete(user)}
                                                                className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                title="Delete User"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {/* Context Switching */}
                                                        <button
                                                            onClick={() => handleSwitchContext(user.id)}
                                                            className={cn(
                                                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ml-2",
                                                                portfolioUserId === user.id
                                                                    ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                                                    : "bg-primary/10 text-primary hover:bg-primary/20"
                                                            )}
                                                        >
                                                            {portfolioUserId === user.id ? (
                                                                <><LogOut className="w-3 h-3" /> Exit View</>
                                                            ) : (
                                                                <><Play className="w-3 h-3" /> View Portfolio</>
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeView === 'system' && (
                        <div className="space-y-8 animate-fade-in">
                            <SystemResources resources={metrics} />
                            <ApiStatusSection />
                        </div>
                    )}

                    {activeView === 'asset-types' && (
                        <div className="animate-fade-in">
                            <SystemAssetTypes />
                        </div>
                    )}

                    {activeView === 'asset-categories' && (
                        <div className="animate-fade-in">
                            <SystemAssetCategories />
                        </div>
                    )}

                    {activeView === 'config' && (
                        <div className="animate-fade-in">
                            <SystemConfig />
                        </div>
                    )}

                    {activeView === 'agents' && (
                        <div className="animate-fade-in">
                            <BackgroundAgentsTable />
                        </div>
                    )}

                    {activeView === 'logs' && (
                        <div className="animate-fade-in">
                            <SystemLogs />
                        </div>
                    )}

                    {activeView === 'market' && (
                        <div className="animate-fade-in">
                            <MarketHistoryTable />
                        </div>
                    )}
                </div>
            </div>

            {/* Reset Password Modal */}
            <Modal
                isOpen={resetModalOpen}
                onClose={() => setResetModalOpen(false)}
                title={`Reset Password for ${selectedUser?.email}`}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">New Password</label>
                        <input
                            type="text"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                            placeholder="Enter new password"
                        />
                    </div>
                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            onClick={() => setResetModalOpen(false)}
                            className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => resetPasswordMutation.mutate()}
                            disabled={!newPassword || resetPasswordMutation.isPending}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {resetPasswordMutation.isPending ? "Updating..." : "Update Password"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!confirmationState}
                onClose={() => setConfirmationState(null)}
                onConfirm={handleConfirmAction}
                title={confirmProps.title}
                message={confirmProps.message}
                variant={confirmProps.variant}
                confirmText={confirmProps.confirmText}
            />
        </div >
    );
}
