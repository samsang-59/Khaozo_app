import { useAuth } from '@/context/AuthContext.jsx';
import AuthGate from './AuthGate.jsx';
import NotFoundPage from '@/pages/NotFoundPage.jsx';

// 👑 admin only. Non-admins see Not found (the page's existence isn't advertised).
export default function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <AuthGate title="Admin sign in">{children}</AuthGate>;
  return isAdmin ? children : <NotFoundPage />;
}
