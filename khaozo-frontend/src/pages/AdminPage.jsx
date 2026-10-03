// Admin `/admin` 👑 — ink top bar (separate from the user app). Queues: New places · Reports
// · Dishes (approve / merge) · Moderation (remove a rating / review), plus the config editor.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as admin from '@/api/admin.api.js';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Textarea } from '@/components/ui/Input.jsx';
import { Segmented } from '@/components/ui/Segmented.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';
import { formatDate, PLACE_TYPE_LABEL, DISH_DIET_LABEL } from '@/lib/format.js';
import { cn } from '@/lib/cn.js';

const REASON = {
  closed: 'Permanently closed',
  not_found: 'Not found there',
  wrong_location: 'Wrong location',
  wrong_hours: 'Wrong hours',
  wrong_info: 'Wrong details',
  duplicate: 'Duplicate',
};
const ageDays = (iso) => `${Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))} d`;

const useQueue = (key, fn, params) =>
  useInfiniteQuery({
    queryKey: ['admin', key, params],
    queryFn: ({ pageParam }) => fn({ ...params, limit: 20, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

function Table({ head, children, empty, loading, more }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border-2 border-ink bg-card">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b-2 border-ink">
              {head.map((h) => (
                <th key={h} className="px-4 py-3 font-display text-[11px] font-extrabold tracking-[0.08em] text-muted uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr+tr]:border-t-2 [&>tr+tr]:border-ink">{children}</tbody>
        </table>
        {loading && <Skeleton className="m-4 h-10" />}
        {!loading && empty && <p className="px-4 py-6 text-sm font-bold text-body">{empty}</p>}
      </div>
      {more}
    </div>
  );
}

function MoreButton({ q }) {
  if (!q.hasNextPage) return null;
  return (
    <Button onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage}>
      Load more
    </Button>
  );
}

function Places() {
  const [status, setStatus] = useState('unverified');
  const qc = useQueryClient();
  const q = useQueue('places', admin.listAdminPlaces, { status });
  const act = useMutation({
    mutationFn: ({ id, action }) => admin.placeAction(id, action),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['place', String(p.id)] });
      toast.success(`${p.name}: ${p.deletedAt ? 'deleted' : p.status}`);
    },
    onError: toastError,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        size="md"
        label="Place status"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'unverified', label: 'Unverified' },
          { value: 'closed', label: 'Closed' },
          { value: 'deleted', label: 'Deleted' },
        ]}
      />
      <Table head={['Place', 'Added by', 'Confirms', 'Age', '']} loading={q.isPending} empty={!rows.length && 'Nothing in this queue.'} more={<MoreButton q={q} />}>
        {rows.map((p) => (
          <tr key={p.id} className={cn(p.pendingReports > 0 && 'bg-mixed')}>
            <td className="px-4 py-3">
              <Link to={`/places/${p.id}`} target="_blank" className="font-display text-base font-extrabold no-underline hover:underline">
                {p.name}
              </Link>
              <p className="text-xs font-bold text-body">
                {p.areaName} · {PLACE_TYPE_LABEL[p.placeType]} · {p.source}
                {p.pendingReports > 0 && <span className="text-[#8a5a00]"> · {p.pendingReports} open report{p.pendingReports > 1 ? 's' : ''}</span>}
              </p>
            </td>
            <td className="px-4 py-3 text-sm font-extrabold">{p.addedByName ?? '—'}</td>
            <td className="px-4 py-3 font-display text-sm font-extrabold">{Math.floor(p.confirmations)}</td>
            <td className="px-4 py-3 font-display text-sm font-extrabold">{ageDays(p.createdAt)}</td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-2">
                {status === 'unverified' && (
                  <Button size="sm" variant="green" onClick={() => act.mutate({ id: p.id, action: 'verify' })}>
                    Verify
                  </Button>
                )}
                {status !== 'unverified' ? (
                  <Button size="sm" onClick={() => act.mutate({ id: p.id, action: 'restore' })}>
                    Restore
                  </Button>
                ) : (
                  <>
                    <Button size="sm" onClick={() => act.mutate({ id: p.id, action: 'close' })}>
                      Close
                    </Button>
                    <Button size="sm" onClick={() => act.mutate({ id: p.id, action: 'delete' })}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-xs font-bold text-body">Places auto-verify at the confirmation threshold (config place_verify_threshold). Verify here to skip the wait.</p>
    </div>
  );
}

// Corrected details when accepting a report the API can't apply on its own
function ChangeForm({ report, onSubmit, busy }) {
  const [lat, setLat] = useState(report.suggestedChange?.lat ?? report.placeLat ?? '');
  const [lng, setLng] = useState(report.suggestedChange?.lng ?? report.placeLng ?? '');
  const [opens, setOpens] = useState('11:00');
  const [closes, setCloses] = useState('23:00');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  let fields;
  let change;
  if (report.reason === 'wrong_location') {
    fields = (
      <>
        <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="lat" className="h-9 w-32" aria-label="Latitude" />
        <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="lng" className="h-9 w-32" aria-label="Longitude" />
      </>
    );
    change = { lat: Number(lat), lng: Number(lng) };
  } else if (report.reason === 'wrong_hours') {
    fields = (
      <>
        <input type="time" value={opens} onChange={(e) => setOpens(e.target.value)} className="h-9 rounded-[10px] border-2 border-ink px-2" aria-label="Opens" />
        <input type="time" value={closes} onChange={(e) => setCloses(e.target.value)} className="h-9 rounded-[10px] border-2 border-ink px-2" aria-label="Closes" />
        <span className="text-xs font-bold">every day</span>
      </>
    );
    change = { hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opensAt: opens, closesAt: closes })) };
  } else {
    fields = (
      <>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New name" className="h-9 w-48" aria-label="New name" />
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="New address" className="h-9 w-56" aria-label="New address" />
      </>
    );
    change = Object.fromEntries(Object.entries({ name: name.trim(), address: address.trim() }).filter(([, v]) => v));
  }
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {fields}
      <Button size="sm" variant="green" loading={busy} onClick={() => onSubmit(change)}>
        Accept with this fix
      </Button>
    </div>
  );
}

function Reports() {
  const [status, setStatus] = useState('pending');
  const [needsChange, setNeedsChange] = useState(null);
  const qc = useQueryClient();
  const q = useQueue('reports', admin.listReports, { status });
  const resolve = useMutation({
    mutationFn: ({ id, action, change }) => admin.resolveReport(id, change ? { action, change } : { action }),
    onSuccess: (_, v) => {
      setNeedsChange(null);
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success(v.action === 'accept' ? 'Accepted — fix applied' : 'Rejected');
    },
    onError: (err, v) => {
      // The API can't apply this one without corrected details → open the fix form
      if (err.code === 'REPORT_CHANGE_REQUIRED') setNeedsChange(v.id);
      toastError(err);
    },
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const canFix = (r) => ['wrong_location', 'wrong_hours', 'wrong_info'].includes(r.reason);
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        size="md"
        label="Report status"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'pending', label: 'Pending' },
          { value: 'accepted', label: 'Accepted' },
          { value: 'rejected', label: 'Rejected' },
        ]}
      />
      <Table head={['Place', 'Report', 'By', 'Age', '']} loading={q.isPending} empty={!rows.length && 'No reports here.'} more={<MoreButton q={q} />}>
        {rows.map((r) => (
          <tr key={r.id} className={cn(r.reason === 'duplicate' && 'bg-mixed')}>
            <td className="px-4 py-3 align-top">
              <Link to={`/places/${r.placeId}`} target="_blank" className="font-display text-base font-extrabold no-underline hover:underline">
                {r.placeName}
              </Link>
              <p className="text-xs font-bold text-body">{r.placeDeletedAt ? 'deleted' : r.placeStatus}</p>
            </td>
            <td className="max-w-[340px] px-4 py-3 align-top text-sm">
              <p className="font-extrabold">
                {REASON[r.reason]}
                {r.duplicateOfName && ` of ${r.duplicateOfName}`}
              </p>
              {r.details && <p className="font-medium text-body">“{r.details}”</p>}
              {r.suggestedChange && <p className="font-mono text-xs text-body">{JSON.stringify(r.suggestedChange)}</p>}
              {needsChange === r.id && canFix(r) && <ChangeForm report={r} busy={resolve.isPending} onSubmit={(change) => resolve.mutate({ id: r.id, action: 'accept', change })} />}
            </td>
            <td className="px-4 py-3 align-top text-sm font-extrabold">{r.reportedByName ?? 'Former diner'}</td>
            <td className="px-4 py-3 align-top font-display text-sm font-extrabold">{ageDays(r.createdAt)}</td>
            <td className="px-4 py-3 align-top">
              {status === 'pending' ? (
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="green" onClick={() => resolve.mutate({ id: r.id, action: 'accept' })}>
                    Accept
                  </Button>
                  {canFix(r) && (
                    <Button size="sm" onClick={() => setNeedsChange(needsChange === r.id ? null : r.id)}>
                      Fix…
                    </Button>
                  )}
                  <Button size="sm" onClick={() => resolve.mutate({ id: r.id, action: 'reject' })}>
                    Reject
                  </Button>
                </div>
              ) : (
                <span className="text-xs font-bold text-body">
                  {r.reviewedByName ?? ''} {formatDate(r.reviewedAt)}
                </span>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function Dishes() {
  const qc = useQueryClient();
  const q = useQueue('dishes', admin.listPendingDishes, {});
  const [names, setNames] = useState({});
  const update = useMutation({
    mutationFn: ({ id, body }) => admin.updateDish(id, body),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success(v.body.action === 'merge' ? 'Merged' : 'Approved');
    },
    onError: toastError,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Table head={['New dish', 'Added by', 'On menus', 'Merge into', '']} loading={q.isPending} empty={!rows.length && 'No dishes waiting for review.'} more={<MoreButton q={q} />}>
      {rows.map((d) => (
        <tr key={d.id} className={cn(d.similar?.length > 0 && 'bg-mixed')}>
          <td className="px-4 py-3 align-top">
            <Input
              value={names[d.id] ?? d.name}
              onChange={(e) => setNames((n) => ({ ...n, [d.id]: e.target.value }))}
              className="h-9 w-56 font-display font-extrabold"
              aria-label={`Name of ${d.name}`}
            />
            <p className="pt-1 text-xs font-bold text-body">
              {d.category} · {d.cuisine} · {DISH_DIET_LABEL[d.diet]}
            </p>
          </td>
          <td className="px-4 py-3 align-top text-sm font-extrabold">{d.createdByName ?? '—'}</td>
          <td className="px-4 py-3 align-top font-display text-sm font-extrabold">{d.menuItemCount}</td>
          <td className="px-4 py-3 align-top">
            <div className="flex flex-col gap-1.5">
              {(d.similar ?? []).map((s) => (
                <Button key={s.id} size="sm" onClick={() => update.mutate({ id: d.id, body: { action: 'merge', intoId: s.id } })}>
                  → {s.name}
                </Button>
              ))}
              {!d.similar?.length && <span className="text-xs font-bold text-body">No similar dish</span>}
            </div>
          </td>
          <td className="px-4 py-3 align-top">
            <Button
              size="sm"
              variant="green"
              onClick={() => {
                const name = (names[d.id] ?? d.name).trim();
                update.mutate({ id: d.id, body: name && name !== d.name ? { action: 'approve', name } : { action: 'approve' } });
              }}
            >
              Approve
            </Button>
          </td>
        </tr>
      ))}
    </Table>
  );
}

function Moderation() {
  const [kind, setKind] = useState('ratings');
  const [id, setId] = useState('');
  const remove = useMutation({
    mutationFn: () => (kind === 'ratings' ? admin.removeRating(Number(id)) : admin.removeReview(Number(id))),
    onSuccess: () => {
      setId('');
      toast.success('Removed (soft delete) — hidden everywhere');
    },
    onError: toastError,
  });
  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-2xl border-2 border-ink bg-card p-5">
      <h2 className="text-xl tracking-[-0.02em]">Remove a rating or review</h2>
      <p className="text-sm font-semibold text-body">Spam or abuse reported to you? Remove it by id. It's hidden everywhere (also from the author's journal) and kept in the database.</p>
      <Segmented
        size="md"
        label="What to remove"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'ratings', label: 'Dish rating' },
          { value: 'reviews', label: 'Place review' },
        ]}
      />
      <div className="flex gap-2">
        <Input value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ''))} placeholder="id" className="h-11 w-40" aria-label="Id" inputMode="numeric" />
        <Button variant="danger" disabled={!id} loading={remove.isPending} onClick={() => remove.mutate()}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function ConfigRow({ item }) {
  const qc = useQueryClient();
  const isNumber = typeof item.value === 'number';
  const [text, setText] = useState(isNumber ? String(item.value) : JSON.stringify(item.value, null, 1));
  const save = useMutation({
    mutationFn: () => admin.updateConfig(item.key, isNumber ? Number(text) : JSON.parse(text)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'config'] });
      toast.success(`${item.key} saved`);
    },
    onError: (err) => {
      if (err instanceof SyntaxError) toast.error('That is not valid JSON');
      else if (err.details?.length) toast.error(err.details.map((d) => d.message).join(' · '));
      else toastError(err);
    },
  });
  const changed = text !== (isNumber ? String(item.value) : JSON.stringify(item.value, null, 1));
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[13px] font-bold break-all">{item.key}</p>
          {item.description && <p className="text-xs font-semibold text-body">{item.description}</p>}
        </div>
        {isNumber && <Input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" className="h-9 w-20 text-center font-display font-extrabold" aria-label={item.key} />}
      </div>
      {!isNumber && <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[64px] font-mono text-xs" aria-label={item.key} spellCheck={false} />}
      {changed && (
        <Button size="sm" variant="primary" className="self-end" loading={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      )}
    </div>
  );
}

function ConfigEditor() {
  const q = useQuery({ queryKey: ['admin', 'config'], queryFn: admin.getConfig });
  return (
    <aside className="flex flex-col gap-3">
      <h2 className="text-[22px] tracking-[-0.02em]">Config</h2>
      {q.isPending ? (
        <Skeleton className="h-60 rounded-2xl" />
      ) : (
        <div className="max-h-[calc(100dvh-200px)] overflow-y-auto rounded-2xl border-2 border-ink bg-card [&>*+*]:border-t-2 [&>*+*]:border-ink">
          {q.data?.map((item) => (
            <ConfigRow key={`${item.key}-${item.updatedAt}`} item={item} />
          ))}
        </div>
      )}
      <p className="text-xs font-bold text-body">Values keep their shape (numbers stay numbers, objects keep their keys). Changes apply within one request.</p>
    </aside>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState('places');
  useEffect(() => {
    document.title = 'Admin — Khaozo';
  }, []);
  const tabs = [
    { value: 'places', label: 'New places' },
    { value: 'reports', label: 'Reports' },
    { value: 'dishes', label: 'Dish merges' },
    { value: 'moderation', label: 'Moderation' },
  ];
  return (
    <div className="min-h-dvh bg-cream">
      <header className="flex h-[76px] items-center justify-between bg-ink px-6 lg:px-12">
        <div className="flex items-center gap-3">
          <Link to="/" className="font-display text-[26px] font-extrabold tracking-[-0.04em] text-saffron no-underline">
            khaozo
          </Link>
          <Badge tone="amber" className="border-saffron bg-saffron px-2 py-0.5 text-[11px]">
            Admin
          </Badge>
        </div>
        <Link to="/" className="text-sm font-extrabold text-cream no-underline hover:underline">
          ← Back to app
        </Link>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-6 lg:grid-cols-[1fr_380px] lg:px-12 lg:py-8">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="no-scrollbar overflow-x-auto">
            <Segmented size="md" label="Queues" value={tab} onChange={setTab} options={tabs} />
          </div>
          {tab === 'places' && <Places />}
          {tab === 'reports' && <Reports />}
          {tab === 'dishes' && <Dishes />}
          {tab === 'moderation' && <Moderation />}
        </div>
        <ConfigEditor />
      </div>
    </div>
  );
}
