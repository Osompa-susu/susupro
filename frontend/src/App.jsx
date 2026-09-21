import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { RequireAuth, RequireRole } from './components/RouteGuards.jsx';
import Layout from './components/Layout.jsx';

import Login from './pages/Login.jsx';
import ForcePasswordChange from './pages/ForcePasswordChange.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CustomerRegister from './pages/CustomerRegister.jsx';
import CustomerProfile from './pages/CustomerProfile.jsx';
import Deposit from './pages/Deposit.jsx';
import WithdrawRequest from './pages/WithdrawRequest.jsx';
import AccountSettings from './pages/AccountSettings.jsx';

import CustomersList from './pages/admin/CustomersList.jsx';
import Workers from './pages/admin/Workers.jsx';
import WithdrawalApprovals from './pages/admin/WithdrawalApprovals.jsx';
import Transactions from './pages/admin/Transactions.jsx';
import Reports from './pages/admin/Reports.jsx';
import AuditLogs from './pages/admin/AuditLogs.jsx';
import Security from './pages/admin/Security.jsx';
import Devices from './pages/admin/Devices.jsx';

import CustomerSearch from './pages/worker/CustomerSearch.jsx';
import MyTransactions from './pages/worker/MyTransactions.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<RequireAuth><ForcePasswordChange /></RequireAuth>} />

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers/:customerCode" element={<CustomerProfile />} />
        <Route path="/customers/register" element={<CustomerRegister />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/withdraw" element={<WithdrawRequest />} />
        <Route path="/settings" element={<AccountSettings />} />
        <Route path="/profile" element={<AccountSettings />} />

        <Route path="/customers" element={<RequireRole role="admin"><CustomersList /></RequireRole>} />
        <Route path="/workers" element={<RequireRole role="admin"><Workers /></RequireRole>} />
        <Route path="/withdrawals" element={<RequireRole role="admin"><WithdrawalApprovals /></RequireRole>} />
        <Route path="/transactions" element={<RequireRole role="admin"><Transactions /></RequireRole>} />
        <Route path="/reports" element={<RequireRole role="admin"><Reports /></RequireRole>} />
        <Route path="/audit-logs" element={<RequireRole role="admin"><AuditLogs /></RequireRole>} />
        <Route path="/security" element={<RequireRole role="admin"><Security /></RequireRole>} />
        <Route path="/devices" element={<RequireRole role="admin"><Devices /></RequireRole>} />

        <Route path="/customers/search" element={<RequireRole role="worker"><CustomerSearch /></RequireRole>} />
        <Route path="/my-transactions" element={<RequireRole role="worker"><MyTransactions /></RequireRole>} />
      </Route>
    </Routes>
  );
}
