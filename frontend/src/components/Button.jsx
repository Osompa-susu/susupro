import React from 'react';

const variants = {
  primary: 'bg-teal text-white hover:bg-teal-dark disabled:opacity-50',
  gold: 'bg-gold text-white hover:brightness-95 disabled:opacity-50',
  danger: 'bg-white text-bad border border-bad hover:bg-red-50 disabled:opacity-50',
  ghost: 'bg-panel text-teal-dark border border-line hover:border-teal disabled:opacity-50',
};

export default function Button({ variant = 'primary', loading = false, children, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition-colors ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
