import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Button from './Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      <Sidebar role={user.role} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-panel px-6 py-3">
          <div className="text-sm"><span className="font-semibold">{user.fullName}</span> <span className="capitalize text-muted">· {user.role}</span></div>
          <Button variant="ghost" onClick={logout} className="!px-3 !py-1.5 text-xs">Log out</Button>
        </header>
        <main className="flex-1 px-5 py-6 sm:px-8"><Outlet /></main>
      </div>
    </div>
  );
}
