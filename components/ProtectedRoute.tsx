import { Navigate, useLocation } from 'react-router-dom';
import type { Company } from '../types.ts';
import { MASTER_EMAIL } from '../config.ts';

interface ProtectedRouteProps {
  company: Company | null;
  children: React.ReactNode;
  requireMaster?: boolean;
}

export const ProtectedRoute = ({ company, children, requireMaster = false }: ProtectedRouteProps) => {
  const location = useLocation();

  if (!company) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isMaster = company.email === MASTER_EMAIL;

  if (requireMaster && !isMaster) {
     return <Navigate to="/dashboard" replace />;
  }

  if (!isMaster) {
      if (company.status === 'pending_approval') {
          if (location.pathname !== '/pending') return <Navigate to="/pending" replace />;
      } else if (company.status === 'waiting_payment' || company.status === 'suspended') {
          if (location.pathname !== '/payment') return <Navigate to="/payment" replace />;
      } else {
          // If active but trying to access restrictions
          if (location.pathname === '/pending' || location.pathname === '/payment') {
              return <Navigate to="/dashboard" replace />;
          }
      }
  }

  return <>{children}</>;
};
