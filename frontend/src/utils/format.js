export function fmtGHS(n) {
  const v = Number(n) || 0;
  return `${v < 0 ? '-' : ''}GHS ${Math.abs(v).toFixed(2)}`;
}
export function fmtDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
