import React from 'react';

export function Field({ label, error, children }) {
  return (
    <div className="mb-3.5">
      {label && <label className="mb-1 block text-xs text-muted">{label}</label>}
      {children}
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}

export function Input({ label, error, className = '', ...props }) {
  return (
    <Field label={label} error={error}>
      <input className={`w-full rounded border px-3 py-2 text-sm outline-none focus:border-teal ${error ? 'border-bad' : 'border-line'} ${className}`} {...props} />
    </Field>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <Field label={label} error={error}>
      <select className={`w-full rounded border px-3 py-2 text-sm outline-none focus:border-teal ${error ? 'border-bad' : 'border-line'} ${className}`} {...props}>
        {children}
      </select>
    </Field>
  );
}
