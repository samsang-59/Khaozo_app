// 🔐 pages: logged out → a sign-in prompt (the Login sheet opens on tap); after sign-in the page renders.
import { useAuth } from '@/context/AuthContext.jsx';
import { Button } from '@/components/ui/Button.jsx';

export default function AuthGate({ title = 'Sign in to continue', children }) {
  const { user, openLogin } = useAuth();
  if (user) return children;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-16 lg:pt-24">
      <h1 className="text-[34px] leading-none tracking-[-0.03em]">{title}</h1>
      <p className="text-[15px] font-semibold text-body">Sign in with Google to rate dishes, keep a food journal and plan with friends. Takes 2 seconds.</p>
      <Button variant="primary" size="lg" onClick={() => openLogin()}>
        Continue with Google
      </Button>
    </div>
  );
}
