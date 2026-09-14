import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV = {
  admin: [
    ['/', 'Dashboard'], ['/customers', 'Customers'], ['/workers', 'Workers'],
    ['/withdrawals', 'Withdrawals'], ['/transactions', 'Transactions'],
    ['/reports', 'Reports'], ['/audit-logs', 'Audit Logs'],
    ['/security', 'Security'], ['/devices', 'Devices'], ['/settings', 'Settings'],
  ],
  worker: [
    ['/', 'Dashboard'], ['/customers/search', 'Customer Search'], ['/customers/register', 'Register Customer'],
    ['/deposit', 'Deposit'], ['/withdraw', 'Withdrawal'], ['/my-transactions', 'My Transactions'],
    ['/profile', 'Profile'],
  ],
};

export default function Sidebar({ role }) {
  return (
    <nav className="flex shrink-0 flex-row overflow-x-auto bg-teal-dark p-2.5 sm:w-56 sm:flex-col sm:overflow-visible sm:py-5">
      {(NAV[role] || []).map(([to, label]) => (
        <NavLink key={to} to={to} end={to === '/'}
          className={({ isActive }) => `whitespace-nowrap border-b-[3px] px-4 py-2.5 text-sm sm:border-b-0 sm:border-l-[3px] ${isActive ? 'border-gold bg-white/5 font-semibold text-white' : 'border-transparent text-[#cfc9bb] hover:text-white'}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
