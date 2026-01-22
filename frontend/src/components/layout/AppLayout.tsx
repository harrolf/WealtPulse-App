import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
    LayoutDashboard,
    Wallet,
    Settings,
    Menu,
    X,
    ChevronLeft,
    ChevronRight,
    Building2,
    Layers,
    Coins,
    Tag as TagIcon,
    Shield,
    LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { AuthService } from '@/services/auth';
import { getPortfolioUser, setPortfolioUser } from '@/services/api';
import { Eye } from 'lucide-react';
import logoSmall from '@/assets/logo-small.svg';

const NAV_ITEMS = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Assets', icon: Wallet, path: '/assets' },
    { label: 'Custodians', icon: Building2, path: '/custodians' },
    { label: 'Asset Types', icon: Layers, path: '/asset-types' },
    { label: 'Groups & Tags', icon: TagIcon, path: '/groups-tags' },
    { label: 'Currencies', icon: Coins, path: '/currencies' },
];

export function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const location = useLocation();

    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: AuthService.getCurrentUser,
        retry: false
    });

    const navItems = user?.is_admin
        ? [...NAV_ITEMS, { label: 'Admin', icon: Shield, path: '/admin' }]
        : NAV_ITEMS;

    const handleLogout = () => {
        AuthService.logout();
    };

    const portfolioUserId = getPortfolioUser();

    return (
        <div className="h-screen w-full bg-background text-foreground flex overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
                className={cn(
                    "fixed top-0 left-0 z-50 h-screen glass-strong border-r border-border/50 transition-all duration-300 lg:static animate-slide-up flex flex-col",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                    isCollapsed ? "lg:w-20" : "lg:w-64",
                    !sidebarOpen && "w-64" // Mobile always full width when open
                )}
            >
                {/* Logo/Brand */}
                <div className={cn("h-20 flex items-center border-b border-border/50 relative", isCollapsed ? "justify-center px-0" : "px-6")}>
                    <div className="flex items-center gap-3">
                        <img src={logoSmall} alt="WealthPulse" className="h-10 w-10 flex-shrink-0" />
                        <div className={cn("transition-opacity duration-200", isCollapsed ? "opacity-0 hidden lg:block w-0 overflow-hidden" : "opacity-100")}>
                            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
                                WealthPulse
                            </span>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">Portfolio Tracker</p>
                        </div>
                    </div>

                    {/* Toggle Button (Desktop) */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-background border border-border rounded-full items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors shadow-sm z-50"
                    >
                        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                    </button>

                    <button
                        className="ml-auto lg:hidden p-2 hover:bg-muted/50 rounded-lg transition-colors"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setSidebarOpen(false)}
                                title={isCollapsed ? item.label : undefined}
                                className={cn(
                                    "group flex items-center rounded-xl text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "gradient-primary text-white shadow-lg shadow-primary/25"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                    isCollapsed ? "justify-center px-2 py-3" : "px-4 py-3.5"
                                )}
                            >
                                <Icon className={cn(
                                    "h-5 w-5 transition-transform duration-200 flex-shrink-0",
                                    isActive && "scale-110",
                                    !isCollapsed && "mr-3"
                                )} />
                                {!isCollapsed && (
                                    <span>{item.label}</span>
                                )}
                                {isActive && !isCollapsed && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Secondary Navigation (Bottom) */}
                <div className="p-4 border-t border-border/50 space-y-2">
                    <Link
                        to="/settings"
                        onClick={() => setSidebarOpen(false)}
                        title={isCollapsed ? "Settings" : undefined}
                        className={cn(
                            "group flex items-center rounded-xl text-sm font-medium transition-all duration-200",
                            location.pathname === "/settings"
                                ? "gradient-primary text-white shadow-lg shadow-primary/25"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                            isCollapsed ? "justify-center px-2 py-3" : "px-4 py-3.5"
                        )}
                    >
                        <Settings className={cn(
                            "h-5 w-5 transition-transform duration-200 flex-shrink-0",
                            location.pathname === "/settings" && "scale-110",
                            !isCollapsed && "mr-3"
                        )} />
                        {!isCollapsed && <span>Settings</span>}
                    </Link>

                    <button
                        onClick={handleLogout}
                        title={isCollapsed ? "Logout" : undefined}
                        className={cn(
                            "w-full group flex items-center rounded-xl text-sm font-medium transition-all duration-200 text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                            isCollapsed ? "justify-center px-2 py-3" : "px-4 py-3.5"
                        )}
                    >
                        <LogOut className={cn(
                            "h-5 w-5 transition-transform duration-200 flex-shrink-0",
                            !isCollapsed && "mr-3"
                        )} />
                        {!isCollapsed && <span>Logout</span>}
                    </button>
                </div>

                {/* Footer - Removed hardcoded value to avoid confusion */}
                {/* <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border/50">
                    <div className="glass rounded-xl p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Portfolio</p>
                        <p className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                            $3,000
                        </p>
                    </div>
                </div> */}
                <div className="p-4 border-t border-border/50">
                    {/* Placeholder or real data could go here, but removing for now */}
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Impersonation Banner */}
                {portfolioUserId && (
                    <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between text-sm shadow-md z-50">
                        <span className="font-medium flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            Viewing Portfolio of User ID: {portfolioUserId}
                        </span>
                        <button
                            onClick={() => setPortfolioUser(null)}
                            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-bold transition-colors"
                        >
                            Exit View
                        </button>
                    </div>
                )}

                {/* Mobile Header */}
                <header className="h-16 flex items-center px-4 border-b border-border/50 lg:hidden glass-strong">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 -ml-2 hover:bg-muted/50 rounded-lg transition-colors"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                    <div className="ml-4 flex items-center gap-2">
                        <img src={logoSmall} alt="WealthPulse" className="h-8 w-8" />
                        <span className="font-semibold">WealthPulse</span>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 lg:p-8 overflow-auto">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
