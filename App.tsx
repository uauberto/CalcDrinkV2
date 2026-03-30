
import React, { useState, useEffect } from 'react';
import type { Company } from './types.ts';
import Auth from './components/Auth.tsx';
import Dashboard from './components/Dashboard.tsx';
import ApprovalPending from './components/ApprovalPending.tsx';
import Subscription from './components/Subscription.tsx';
import MasterDashboard from './components/MasterDashboard.tsx'; // Importar o Dashboard Master
import { useLocalStorage } from './hooks/useLocalStorage.ts';
import { api } from './lib/supabase.ts';
import { ENABLE_DATABASE, MASTER_EMAIL } from './config.ts';

const App: React.FC = () => {
  const [allCompanies, setAllCompanies] = useLocalStorage<Company[]>('registered_companies', []);
  const [masterView, setMasterView] = useState<'admin' | 'app'>('admin');
  
  const [currentCompany, setCurrentCompany] = useState<Company | null>(() => {
    const saved = localStorage.getItem('current_company_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Initialize Master User on app load
  useEffect(() => {
    if (ENABLE_DATABASE) {
      api.admin.initMasterUser();
    }
  }, []);

  // Helper to update company in both session and localStorage list (and Database if enabled)
  const updateCompanyState = async (updatedCompany: Company) => {
    // Update session
    setCurrentCompany(updatedCompany);
    localStorage.setItem('current_company_session', JSON.stringify(updatedCompany));
    
    // Update master list (Local Storage fallback)
    setAllCompanies(prev => prev.map(c => c.id === updatedCompany.id ? updatedCompany : c));

    // Update Database
    if (ENABLE_DATABASE) {
        await api.auth.update(updatedCompany);
    }
  };

  const handleLogin = (company: Company) => {
    // Ensure compatibility with old data that might miss new fields
    const normalizedCompany: Company = {
        ...company,
        status: company.status || 'active', // Default to active for old users
        plan: company.plan || null,
        nextBillingDate: company.nextBillingDate || null
    };
    
    // Check for subscription expiration on login
    // SKIP CHECK IF USER IS MASTER ADMIN
    if (normalizedCompany.email !== MASTER_EMAIL && normalizedCompany.status === 'active' && normalizedCompany.nextBillingDate) {
        const now = new Date();
        const billingDate = new Date(normalizedCompany.nextBillingDate);
        // Reset time part to ensure we compare dates fairly
        now.setHours(0,0,0,0);
        billingDate.setHours(0,0,0,0);

        if (now > billingDate) {
            normalizedCompany.status = 'suspended'; // Temporarily suspend until pay
        }
    }

    updateCompanyState(normalizedCompany);
  };

  const handleLogout = () => {
    localStorage.removeItem('current_company_session');
    setCurrentCompany(null);
    setMasterView('admin'); // Reset view on logout
  };

  const handleSimulateApproval = async () => {
      if (currentCompany) {
          const updated = { ...currentCompany, status: 'waiting_payment' as const };
          await updateCompanyState(updated);
      }
  };

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
      if (currentCompany) {
          const now = new Date();
          // Add 30 days for monthly, 365 for yearly
          const daysToAdd = plan === 'monthly' ? 30 : 365;
          now.setDate(now.getDate() + daysToAdd);
          
          const updated: Company = { 
              ...currentCompany, 
              status: 'active',
              plan: plan,
              nextBillingDate: now.toISOString()
          };
          
          // This updates state and Supabase
          await updateCompanyState(updated);
      }
  }

  if (!currentCompany) {
    return <Auth onLogin={handleLogin} />;
  }

  const isMaster = currentCompany.email === MASTER_EMAIL;

  // --- MASTER ADMIN ROUTE ---
  // If the logged-in user email matches the MASTER_EMAIL config AND they are in 'admin' view
  if (isMaster && masterView === 'admin') {
      return (
        <MasterDashboard 
            adminUser={currentCompany} 
            onLogout={handleLogout} 
            onSwitchToApp={() => setMasterView('app')}
        />
      );
  }

  // Flow Control based on Company Status
  // Note: Master Admin bypasses these checks to access the App View directly
  
  // 1. Pending Approval (Admin check)
  if (!isMaster && currentCompany.status === 'pending_approval') {
      return <ApprovalPending company={currentCompany} onSimulateApproval={handleSimulateApproval} onLogout={handleLogout} />;
  }

  // 2. Waiting Payment or Suspended (Overdue)
  if (!isMaster && (currentCompany.status === 'waiting_payment' || currentCompany.status === 'suspended')) {
      return <Subscription company={currentCompany} onSubscribe={handleSubscribe} onLogout={handleLogout} />;
  }

  // 3. Active - Show Dashboard
  return (
    <Dashboard 
        key={currentCompany.id} 
        company={currentCompany} 
        onLogout={handleLogout}
        isMasterAdmin={isMaster}
        onSwitchToAdmin={() => setMasterView('admin')}
    />
  );
};

export default App;
