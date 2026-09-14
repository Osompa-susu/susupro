import React from 'react';

export default function DataTable({ columns, rows, keyField = 'id' }) {
  if (!rows || rows.length === 0) return null;
  return (
    <>
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr>{columns.map(c => <th key={c.key} className="border-b border-line px-2.5 py-2 text-left text-xs uppercase tracking-wide text-muted">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row[keyField]} className="border-b border-line/60 last:border-none">
              {columns.map(c => <td key={c.key} className="px-2.5 py-2.5">{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-2 sm:hidden">
        {rows.map(row => (
          <div key={row[keyField]} className="rounded border border-line p-3">
            {columns.map(c => (
              <div key={c.key} className="flex justify-between py-0.5 text-sm">
                <span className="text-muted">{c.label}</span>
                <span className="text-right">{c.render ? c.render(row) : row[c.key]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
