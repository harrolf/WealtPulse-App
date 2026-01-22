import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, /* Key, Link as LinkIcon, */ Trash2, /* Smartphone, Globe, AlertCircle, CheckCircle2, */ AlertTriangle } from 'lucide-react';
import { AuthService } from '@/services/auth';
import { toast } from '@/services/toast';
import { ConfirmationModal } from '../ui/ConfirmationModal';
// import { useFormattedDateTime } from '@/utils/datetime';

export function SecuritySettings() {
    const navigate = useNavigate();
    // const { formatDate } = useFormattedDateTime();
    /*
    interface ConnectedAccount {
        provider: string;
        created_at: string;
    }
    interface Passkey {
        credential_id: string;
        device_name: string;
        created_at: string;
        last_used_at?: string;
    }
    */
    // const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
    // const [passkeys, setPasskeys] = useState<Passkey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            // const [accs, keys] = await Promise.all([
            await Promise.all([
                AuthService.getConnectedAccounts(),
                AuthService.getPasskeys()
            ]);
            // setAccounts(accs as ConnectedAccount[]);
            // setPasskeys(keys as Passkey[]);
        } catch (error) {
            console.error("Failed to fetch security data", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /*
    const handleUnlink = async (provider: string) => {
        if (!confirm(`Are you sure you want to unlink your ${provider} account?`)) return;
        try {
            await AuthService.unlinkOAuthAccount(provider);
            await fetchData();
        } catch (error) {
            console.error(error);
            alert("Failed to unlink account");
        }
    };
    */

    /*
    const handleDeletePasskey = async (id: string) => {
        if (!confirm("Are you sure you want to remove this passkey?")) return;
        try {
            await AuthService.deletePasskey(id);
            await fetchData();
        } catch (error) {
            console.error(error);
            alert("Failed to delete passkey");
        }
    };
    */

    /*
    const handleLink = async (provider: string) => {
        try {
            const { url } = await AuthService.getOAuthUrl(provider);
            window.location.href = url;
        } catch (error) {
            console.error(error);
            alert("Failed to initiate linking");
        }
    };
    */

    /*
    const handleAddPasskey = async () => {
        try {
            await AuthService.registerPasskey();
            await fetchData();
        } catch (error) {
            console.error(error);
        }
    };
    */

    const handleDeleteAccount = () => {
        setShowDeleteConfirm(true);
    };

    const confirmDeleteAccount = async () => {
        try {
            await AuthService.deleteAccount();
            navigate('/login');
            toast.success("Account deleted successfully.");
        } catch (error) {
            console.error("Failed to delete account:", error);
            toast.error("Failed to delete account. Please try again.");
        } finally {
            setShowDeleteConfirm(false);
        }
    };

    /*
    const providers = [
        { id: 'google', name: 'Google', icon: Globe },
        { id: 'apple', name: 'Apple', icon: Smartphone },
        { id: 'linkedin', name: 'LinkedIn', icon: LinkIcon },
    ];
    */

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading security settings...</div>;

    return (
        <div className="space-y-8 animate-slide-up">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Account Security
            </h2>

            {/* OAuth and Passkey management hidden as requested */}
            {/* To re-enable, uncomment the sections below */}

            {/* Danger Zone */}
            <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-6">
                <h3 className="text-red-500 font-semibold flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <div className="flex justify-end">
                    <button
                        onClick={handleDeleteAccount}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete Account
                    </button>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDeleteAccount}
                title="Delete Account"
                message="Are you sure you want to PERMANENTLY DELETE your account? This action cannot be undone and will remove all your data immediately."
                variant="danger"
                confirmText="Delete My Account"
            />
        </div>
    );
}
