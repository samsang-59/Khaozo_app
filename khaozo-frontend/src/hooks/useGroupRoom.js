// Live group state: each `group:state` snapshot replaces local state (full picture every time,
// so a missed message never leaves this phone out of sync). Reconnect → re-join → fresh snapshot.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createGroupSocket, emitAck, getAccessToken, refreshSession } from '@/socket/socket.js';
import { session } from '@/lib/storage.js';
import { useAuth } from '@/context/AuthContext.jsx';

// Per tab, per group: { memberId, guestPass? } — a refresh doesn't create a duplicate guest
export const groupSessionKey = (code) => `kz.group.${code}`;
export const getGroupSession = (code) => session.get(groupSessionKey(code));
export const setGroupSession = (code, value) => session.set(groupSessionKey(code), value);

export function useGroupRoom(code) {
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [status, setStatus] = useState('connecting'); // connecting | live | reconnecting | ended | error
  const [error, setError] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const socketRef = useRef(null);
  const stored = getGroupSession(code);
  const memberId = user ? `u${user.id}` : (stored?.memberId ?? null);

  useEffect(() => {
    const guestPass = !user ? getGroupSession(code)?.guestPass : null;
    if (!user && !guestPass) {
      setStatus('error');
      setError({ code: 'NOT_A_MEMBER', message: 'Join the group first.' });
      return undefined;
    }
    const socket = createGroupSocket(() => guestPass ?? getAccessToken());
    socketRef.current = socket;

    const join = async () => {
      const res = await emitAck(socket, 'group:join', { code });
      if (res.ok) {
        setStatus('live');
        setError(null);
      } else {
        setStatus(res.error?.code === 'GROUP_NOT_FOUND' ? 'ended' : 'error');
        setError(res.error);
      }
    };

    socket.on('connect', join);
    socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') setStatus((s) => (s === 'ended' ? s : 'reconnecting'));
    });
    socket.on('connect_error', async (err) => {
      // Expired access token → refresh once, the next reconnect attempt reads the new one
      if (user && err?.data?.code === 'UNAUTHORIZED') await refreshSession().catch(() => null);
      setStatus((s) => (s === 'live' || s === 'reconnecting' ? 'reconnecting' : s));
    });
    socket.on('group:state', (snap) => {
      setGroup(snap);
      if (snap.status === 'done') setStatus('live');
    });
    socket.on('group:result', (result) => setGroup((g) => (g ? { ...g, status: 'done', result } : g)));
    socket.on('group:error', (e) => setError(e));
    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, user]);

  const send = useCallback(async (event, payload) => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, error: { code: 'OFFLINE', message: 'Reconnecting… try again in a moment.' } };
    return emitAck(socket, event, payload);
  }, []);

  const actions = {
    setPreferences: (prefs) => send('group:set_preferences', prefs),
    setLocation: (loc) => send('group:set_location', loc),
    startSuggestions: () => send('group:start_suggestions'),
    vote: async (placeId) => {
      const res = await send('group:vote', { placeId });
      if (res.ok) setMyVote(placeId);
      return res;
    },
    finish: (placeId) => send('group:finish', placeId ? { placeId } : {}),
    leave: () => send('group:leave'),
  };

  const me = group?.members.find((m) => m.id === memberId) ?? null;
  return { group, status, error, me, memberId, isCreator: !!me && group?.creatorId === me.id, myVote, ...actions };
}
