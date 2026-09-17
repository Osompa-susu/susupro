import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper p-6 text-center">
          <h1 className="text-lg font-semibold text-teal-dark">Something went wrong</h1>
          <p className="max-w-sm text-sm text-muted">
            This page ran into an unexpected error. Your data is safe — nothing was lost. Try reloading the page.
          </p>
          <button onClick={() => window.location.reload()} className="rounded bg-teal-dark px-4 py-2 text-sm font-medium text-white">
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}