// Settings `/settings` — name, public journal, veg only (taste diet), default area; log out,
// log out everywhere; Delete account (→ /settings/delete).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { editTasteProfile, getTasteProfile, updateMe } from '@/api/me.api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useUserLocation } from '@/context/LocationContext.jsx';
import PageHeader, { Container } from '@/components/layout/PageHeader.jsx';
import { ListCard } from '@/components/ui/Card.jsx';
import { Switch } from '@/components/ui/Switch.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';

function Row({ title, sub, children, as: Tag = 'div', ...props }) {
  return (
    <Tag className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left" {...props}>
      <span className="min-w-0">
        <span className="block text-[15px] font-extrabold">{title}</span>
        {sub && <span className="block text-xs font-bold text-body">{sub}</span>}
      </span>
      {children}
    </Tag>
  );
}

export default function SettingsPage() {
  const { user, setUser, signOut } = useAuth();
  const { label, openPicker } = useUserLocation();
  const qc = useQueryClient();
  const taste = useQuery({ queryKey: ['me', 'taste'], queryFn: getTasteProfile });
  const [name, setName] = useState(user.name);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    document.title = 'Settings — Khaozo';
  }, []);

  const saveMe = useMutation({
    mutationFn: updateMe,
    onSuccess: (me) => {
      setUser((u) => ({ ...u, ...me }));
      setEditingName(false);
      toast.success('Saved');
    },
    onError: toastError,
  });
  const vegOnly = useMutation({
    mutationFn: (on) => editTasteProfile({ diet: on ? 'veg' : null }),
    onSuccess: (data) => {
      qc.setQueryData(['me', 'taste'], data);
      qc.invalidateQueries({ queryKey: ['search'] });
    },
    onError: toastError,
  });

  return (
    <Container className="max-w-[760px] px-0 lg:px-5">
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-4 px-5 pb-8 lg:px-0">
        <ListCard>
          <Row title="Name" sub={editingName ? null : user.name}>
            {!editingName && (
              <button type="button" className="link-plain text-[13px]" onClick={() => setEditingName(true)}>
                Edit
              </button>
            )}
          </Row>
          {editingName && (
            <div className="flex gap-2 px-4 py-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} aria-label="Your name" className="h-11" autoFocus />
              <Button variant="primary" disabled={!name.trim() || name.trim() === user.name} loading={saveMe.isPending} onClick={() => saveMe.mutate({ name: name.trim() })}>
                Save
              </Button>
            </div>
          )}
          <Row title="Public journal" sub="Anyone with the link can see your ratings">
            <Switch
              label="Public journal"
              checked={user.journalVisibility === 'public'}
              disabled={saveMe.isPending}
              onChange={(on) => saveMe.mutate({ journalVisibility: on ? 'public' : 'private' })}
            />
          </Row>
          <Row title="Veg only" sub="Hide non-veg dishes everywhere">
            <Switch label="Veg only" checked={taste.data?.diet === 'veg'} disabled={!taste.data || vegOnly.isPending} onChange={(on) => vegOnly.mutate(on)} />
          </Row>
          <Row as="button" type="button" title="Default area" onClick={openPicker}>
            <span className="flex items-center gap-1 text-sm font-extrabold">
              {label} <ChevronRight className="size-4" aria-hidden />
            </span>
          </Row>
        </ListCard>

        <ListCard>
          {user.journalVisibility === 'public' && (
            <Link to={`/u/${user.id}`} className="block px-4 py-3.5 text-[15px] font-extrabold no-underline">
              View my public journal
            </Link>
          )}
          <Row as="button" type="button" title="Log out" onClick={() => signOut()} />
          <Row as="button" type="button" title="Log out on all devices" onClick={() => signOut({ everywhere: true })} />
          <Link to="/settings/delete" className="block px-4 py-3.5 text-[15px] font-extrabold text-danger no-underline">
            Delete account
          </Link>
        </ListCard>
        <p className="text-xs font-bold text-body">Signed in with Google · {user.email}</p>
      </div>
    </Container>
  );
}
