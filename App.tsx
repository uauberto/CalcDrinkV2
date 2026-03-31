import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { Company } from './types.ts';
import Auth from './components/Auth.tsx';
import Dashboard from './components/Dashboard.tsx';
import ApprovalPending from './components/ApprovalPending.tsx';
import Subscription from './components/Subscription.tsx';
import MasterDashboard from './components/MasterDashboard.tsx';
import { useLocalStorage } from './hooks/useLocalStorage.ts';
import { api } from './lib/supabase.ts';
import { ENABLE_DATABASE, MASTER_EMAIL } from './config.ts';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';

const AppLogic: React.FC = () => {
  const navigate = useNavigate();
  const [allCompanies, setAllCompanies] = useLocalStorage<Company[]>('registered_companies', []);
  const [masterView, setMasterView] = useState<'admin' | 'app'>('admin');
  
  const [currentCompany, setCurrentCompany] = useState<Company | null>(() => {
    const saved = localStorage.getItem('current_company_session');
    return saved ? JSON.parse(saved) : null;
  });

  const updateCompanyState = async (updatedCompany: Company) => {
    setCurrentCompany(updatedCompany);
    localStorage.setItem('current_company_session', JSON.stringify(updatedCompany));
    setAllCompanies(prev => prev.map(c => c.id === updatedCompany.id ? updatedCompany : c));
    
    if (ENABLE_DATABASE) {
        await api.auth.update(updatedCompany);
    }
  };

  const handleLogin = (company: Company) => {
    const normalizedCompany: Company = {
        ...company,
        status: company.status || 'active',
        plan: company.plan || null,
        nextBillingDate: company.nextBillingDate || null
    };
    
    if (normalizedCompany.email !== MASTER_EMAIL && normalizedCompany.status === 'active' && normalizedCompany.nextBillingDate) {
        const now = new Date();
        const billingDate = new Date(normalizedCompany.nextBillingDate);
        now.setHours(0,0,0,0);
        billingDate.setHours(0,0,0,0);
        if (now > billingDate) {
            normalizedCompany.status = 'suspended';
        }
    }

    updateCompanyState(normalizedCompany);
    
    if (normalizedCompany.email === MASTER_EMAIL) {
       navigate('/admin');
    } else if (normalizedCompany.status === 'pending_approval') {
       navigate('/pending');
    } else if (normalizedCompany.status === 'waiting_payment' || normalizedCompany.status === 'suspended') {
       navigate('/payment');
    } else {
       navigate('/dashboard');
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('current_company_session');
    setCurrentCompany(null);
    setMasterView('admin');
    if (ENABLE_DATABASE) {
        try { await api.auth.logout(); } catch(e) {}
    }
    navigate('/login');
  };

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
      if (currentCompany) {
          const now = new Date();
          const daysToAdd = plan === 'monthly' ? 30 : 365;
          now.setDate(now.getDate() + daysToAdd);
          
          const updated: Company = { 
              ...currentCompany, 
              status: 'active',
              plan: plan,
              nextBillingDate: now.toISOString()
          };
          
          await updateCompanyState(updated);
          navigate('/dashboard');
      }
  }

  return (
    <Routes>
       <Route path="/" element={<Navigate to={currentCompany ? "/dashboard" : "/login"} replace />} />
       
       <Route path="/login" element={
           currentCompany ? <Navigate to="/dashboard" replace /> : <Auth onLogin={handleLogin} />
       } />

       <Route path="/pending" element={
           <ProtectedRoute company={currentCompany}>
               <ApprovalPending company={currentCompany!} onLogout={handleLogout} />
           </ProtectedRoute>
       } />

       <Route path="/payment" element={
           <ProtectedRoute company={currentCompany}>
               <Subscription company={currentCompany!} onSubscribe={handleSubscribe} onLogout={handleLogout} />
           </ProtectedRoute>
       } />

       <Route path="/dashboard" element={
           <ProtectedRoute company={currentCompany}>
               <Dashboard 
                    key={currentCompany?.id} 
                    company={currentCompany!} 
                    onLogout={handleLogout}
                    isMasterAdmin={currentCompany?.email === MASTER_EMAIL}
                    onSwitchToAdmin={() => { setMasterView('admin'); navigate('/admin'); }}
                />
           </ProtectedRoute>
       } />

       <Route path="/admin" element={
           <ProtectedRoute company={currentCompany} requireMaster={true}>
                {masterView === 'admin' ? (
                     <MasterDashboard 
                        adminUser={currentCompany!} 
                        onLogout={handleLogout} 
                        onSwitchToApp={() => { setMasterView('app'); navigate('/dashboard'); }}
                    />
                ) : (
                    <Navigate to="/dashboard" replace />
                )}
           </ProtectedRoute>
       } />

       <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
    return (
        <BrowserRouter>
            <AppLogic />
        </BrowserRouter>
    );
};

export default App;
