import React from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-paper text-ink p-4 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-serif font-bold mb-2">Something went wrong.</h1>
                    <p className="text-gray-500 mb-6 max-w-md">
                        Our chefs dropped the plate. Please try refreshing the page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-ink text-white rounded-full font-medium hover:opacity-90 transition-opacity"
                    >
                        Refresh
                    </button>
                    {this.state.error && (
                        <pre className="mt-8 p-4 bg-gray-100 rounded-lg text-xs text-left overflow-auto max-w-lg text-gray-600">
                            {this.state.error.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
