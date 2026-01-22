import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4">
                    <h1 className="text-2xl font-bold mb-4 text-red-500">Something went wrong</h1>
                    <div className="bg-slate-900 p-4 rounded border border-slate-800 max-w-lg overflow-auto">
                        <p className="text-sm font-mono text-slate-300 break-words mb-2">
                            {this.state.error?.message}
                        </p>
                        <p className="text-xs text-slate-500">
                            Check the console for more details.
                        </p>
                    </div>
                    <button
                        className="mt-6 px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700 transition"
                        onClick={() => window.location.reload()}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
