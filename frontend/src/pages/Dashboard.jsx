import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import AdminDashboard from './admin/AdminDashboard.jsx';
import WorkerDashboard from './worker/WorkerDashboard.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === 'admin' ? <AdminDashboard /> : <WorkerDashboard />;
}
