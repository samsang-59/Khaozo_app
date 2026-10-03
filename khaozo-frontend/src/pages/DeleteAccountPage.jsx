// Delete account `/settings/delete` (DPDP) — what is deleted / kept without your name,
// type DELETE to confirm → logged out → Home with "Your account was deleted".
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { deleteMe } from '@/api/me.api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import PageHeader, { Container } from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';

export default function DeleteAccountPage() {
  const [text, setText] = useState('');
  const { forgetUser } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Delete account — Khaozo';
  }, []);

  const del = useMutation({
    mutationFn: deleteMe,
    onSuccess: () => {
      forgetUser();
      navigate('/', { replace: true });
      toast.success('Your account was deleted');
    },
    onError: toastError,
  });

  return (
    <Container className="max-w-[560px] px-0 lg:px-5">
      <PageHeader title="Delete your account?" fallback="/settings" />
      <div className="flex flex-col gap-4 px-5 pb-10 lg:px-0">
        <div className="rounded-2xl border-2 border-ink bg-card p-4">
          <p className="font-display text-[11px] font-extrabold tracking-[0.06em] text-danger uppercase">Deleted for good</p>
          <ul className="pt-1.5 text-sm leading-relaxed font-bold">
            <li>Your name, photo and email</li>
            <li>Journal, wishlist and notes</li>
            <li>Taste profile and past groups</li>
            <li>Photos you uploaded</li>
          </ul>
        </div>
        <div className="rounded-2xl border-2 border-ink bg-card p-4">
          <p className="font-display text-[11px] font-extrabold tracking-[0.06em] text-muted uppercase">Kept, without your name</p>
          <ul className="pt-1.5 text-sm leading-relaxed font-bold">
            <li>Dish ratings and place reviews (shown as “Former diner”, their text removed)</li>
            <li>Places you added and confirmed</li>
          </ul>
        </div>
        <label htmlFor="confirm-delete" className="text-sm font-extrabold">
          Type DELETE to confirm
        </label>
        <Input
          id="confirm-delete"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-display text-lg tracking-[0.12em]"
          placeholder="DELETE"
        />
        <Button variant="danger" size="lg" block disabled={text !== 'DELETE'} loading={del.isPending} onClick={() => del.mutate()}>
          Delete my account
        </Button>
        <Link to="/settings" className="link-plain self-center text-sm">
          Keep my account
        </Link>
      </div>
    </Container>
  );
}
