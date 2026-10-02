// groupService — group decision mode: create, join, preferences, location, suggestions, voting,
// tie-break, creator handover, history. Called by HTTP controllers and Socket.IO handlers.
// Live state: Redis (groupLiveRepo). Finished groups: Postgres (groupRepo).
// Does NOT call searchService (feature → feature): shares placeRepo.findCandidates + rankingService.
import crypto from 'node:crypto';
import * as groupLiveRepo from '../repositories/redis/groupLive.repo.js';
import * as groupRepo from '../repositories/group.repo.js';
import * as placeRepo from '../repositories/place.repo.js';
import * as tasteProfileRepo from '../repositories/tasteProfile.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import * as configService from './helpers/config.js';
import * as ranking from './helpers/ranking.js';
import { openingStatus } from '../utils/openingHours.js';
import { toView } from '../utils/taste.js';
import { ok, fail } from '../utils/result.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I mix-ups when read aloud
const CODE_LENGTH = 6;

// identity: { kind: 'user', userId } | { kind: 'guest', guestId, groupCode }
export const memberIdOf = (identity) => (identity.kind === 'user' ? `u${identity.userId}` : `g${identity.guestId}`);

const newCode = () => Array.from(crypto.randomBytes(CODE_LENGTH), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

const makeMember = ({ id, userId = null, name, isGuest }) => ({
  id, userId, name, isGuest, joinedAt: new Date().toISOString(), ready: false, connected: false, prefs: null, location: null,
});

const findMember = (state, memberId) => state.members.find((m) => m.id === memberId);

// ---- Snapshot sent to every phone (full picture each time; never private preferences) ----
export const snapshot = (state) => {
  const voteCounts = {};
  for (const placeId of Object.values(state.votes)) voteCounts[placeId] = (voteCounts[placeId] ?? 0) + 1;
  return {
    code: state.code,
    status: state.status,
    creatorId: state.creatorId,
    location: state.location,
    members: state.members.map((m) => ({
      id: m.id, name: m.name, isGuest: m.isGuest, ready: m.ready, connected: m.connected,
      isCreator: m.id === state.creatorId, hasVoted: m.id in state.votes,
    })),
    readyCount: state.members.filter((m) => m.ready).length,
    suggestions: state.suggestions,
    voteCounts,
    result: state.result,
    createdAt: state.createdAt,
  };
};

// ---- HTTP: create / join / peek / history ----------------------------------------------

const ttlSeconds = async () => (await configService.get('group_expiry_hours')) * 60 * 60;

// Logged in → creator is the user. Guest → needs a display name; the controller then asks
// authService for a guest pass bound to the returned guestId + code.
export const create = async ({ userId = null, guestName = null }) => {
  if (!userId && !guestName) return fail('GUEST_NAME_REQUIRED');
  let member;
  let guestId = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = newCode();
    if (await groupRepo.codeUsed(code)) continue;
    if (userId) {
      const user = await userRepo.findById(userId);
      if (!user) return fail('USER_NOT_FOUND');
      member = makeMember({ id: `u${userId}`, userId, name: user.name, isGuest: false });
    } else {
      guestId = crypto.randomUUID();
      member = makeMember({ id: `g${guestId}`, name: guestName, isGuest: true });
    }
    const state = {
      code, status: 'joining', createdAt: new Date().toISOString(), creatorId: member.id,
      location: null, members: [member], suggestions: null, votes: {}, result: null,
    };
    if (await groupLiveRepo.create(code, state, await ttlSeconds())) {
      return ok({ code, memberId: member.id, guestId, group: snapshot(state) });
    }
  }
  throw new Error('Could not find a free group code');
};

// POST /groups/:code/join — logged in: straight in; guest: name → new guestId (the controller
// turns it into a guest pass — one per guest person). identity is null for a brand-new guest;
// a guest who already has a pass for this group re-joins as themself.
export const join = async (code, { identity = null, guestName = null }) => {
  const max = await configService.get('group_max_members');
  let guestId = null;
  if (!identity) {
    if (!guestName) return fail('GUEST_NAME_REQUIRED');
    guestId = crypto.randomUUID();
  }
  const user = identity?.kind === 'user' ? await userRepo.findById(identity.userId) : null;

  const out = await groupLiveRepo.update(code, (state) => {
    if (state.status === 'done') return { error: 'GROUP_ENDED' };
    const memberId = identity ? memberIdOf(identity) : `g${guestId}`;
    if (findMember(state, memberId)) return { state, memberId }; // already in (rejoin)
    if (identity?.kind === 'guest') return { error: 'NOT_A_MEMBER' }; // a pass is only issued with a membership
    if (state.members.length >= max) return { error: 'GROUP_FULL' };
    state.members.push(
      identity
        ? makeMember({ id: memberId, userId: identity.userId, name: user?.name ?? 'Member', isGuest: false })
        : makeMember({ id: memberId, name: guestName, isGuest: true }),
    );
    return { state, memberId };
  });
  if (out.error) return fail(out.error);
  return ok({ code, memberId: out.memberId, guestId, group: snapshot(out.state) });
};

// GET /groups/:code — join page / "This group has ended"
export const peek = async (code) => {
  const state = await groupLiveRepo.get(code);
  if (!state) return fail('GROUP_NOT_FOUND');
  return ok(snapshot(state));
};

export const history = async (userId) => ok(await groupRepo.listForUser(userId));

// ---- Live actions (Socket.IO) ------------------------------------------------------------

// Membership check used by group:join on a socket
export const connect = async (code, identity) => {
  if (identity.kind === 'guest' && identity.groupCode !== code) return fail('GUEST_PASS_OTHER_GROUP');
  const memberId = memberIdOf(identity);
  const out = await groupLiveRepo.update(code, (state) => {
    const m = findMember(state, memberId);
    if (!m) return { error: 'NOT_A_MEMBER' };
    m.connected = true;
    return { state };
  });
  if (out.error) return fail(out.error);
  return ok({ memberId, group: snapshot(out.state) });
};

export const setConnected = async (code, memberId, connected) => {
  const out = await groupLiveRepo.update(code, (state) => {
    const m = findMember(state, memberId);
    if (!m) return { error: 'NOT_A_MEMBER' };
    m.connected = connected;
    return { state };
  });
  return out.error ? fail(out.error) : ok(snapshot(out.state));
};

const nextCreator = (state) => [...state.members].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0]?.id ?? null;

// Creator's phone died: still offline after the grace period → next member by join order
export const handoverIfCreatorAway = async (code, memberId) => {
  const out = await groupLiveRepo.update(code, (state) => {
    const m = findMember(state, memberId);
    if (state.creatorId !== memberId || !m || m.connected || state.status === 'done') return { error: 'NO_HANDOVER' };
    const others = state.members.filter((x) => x.id !== memberId);
    if (!others.length) return { error: 'NO_HANDOVER' };
    state.creatorId = nextCreator({ members: others });
    return { state };
  });
  return out.error ? fail(out.error) : ok(snapshot(out.state));
};

// prefs: { mode: 'profile' | 'for_now', diet, spice, budget, cuisineIds, avoidIds, strict: {...}, location? }
export const setPreferences = async (code, memberId, prefs) => {
  const out = await groupLiveRepo.update(code, (state) => {
    const m = findMember(state, memberId);
    if (!m) return { error: 'NOT_A_MEMBER' };
    if (state.status !== 'joining') return { error: 'GROUP_NOT_JOINING' };
    if (prefs.mode === 'profile' && !m.userId) return { error: 'GUEST_HAS_NO_PROFILE' };
    const { location, ...rest } = prefs;
    m.prefs = rest;
    if (location) m.location = location;
    m.ready = true;
    return { state };
  });
  return out.error ? fail(out.error) : ok(snapshot(out.state));
};

// Creator: a spot ({ mode: 'spot', lat, lng, label }) or { mode: 'midpoint' }
export const setLocation = async (code, memberId, location) => {
  const out = await groupLiveRepo.update(code, (state) => {
    if (!findMember(state, memberId)) return { error: 'NOT_A_MEMBER' };
    if (state.creatorId !== memberId) return { error: 'NOT_CREATOR' };
    if (state.status !== 'joining') return { error: 'GROUP_NOT_JOINING' };
    state.location = location;
    return { state };
  });
  return out.error ? fail(out.error) : ok(snapshot(out.state));
};

// ---- Suggestions -----------------------------------------------------------------------

// What each member wants. Not ready → logged-in members use their taste profile; guests: nothing.
const memberWants = async (m) => {
  let profile = null;
  if (m.userId && (!m.ready || m.prefs?.mode === 'profile')) {
    const p = await tasteProfileRepo.findByUserId(m.userId);
    profile = p ? toView(p) : null;
  }
  if (m.ready && m.prefs?.mode === 'for_now') {
    return { diet: m.prefs.diet ?? null, budget: m.prefs.budget ?? null, cuisineIds: m.prefs.cuisineIds ?? [], strict: m.prefs.strict ?? {} };
  }
  if (profile) {
    return {
      diet: profile.diet,
      budget: profile.effective.budget == null ? null : Math.round(profile.effective.budget),
      cuisineIds: profile.cuisineIds,
      strict: m.ready ? m.prefs?.strict ?? {} : {},
    };
  }
  return null;
};

// Strict ("can't compromise") → place removed. Unknown place data never removes a place.
const passesStrict = (w, place) => {
  const s = w.strict ?? {};
  if (s.diet && (w.diet === 'veg' || w.diet === 'egg') && place.dietType === 'non_veg') return false;
  if (s.budget && w.budget && place.priceLevel && place.priceLevel > w.budget) return false;
  if (s.cuisines && w.cuisineIds?.length && place.cuisineIds.length && !place.cuisineIds.some((c) => w.cuisineIds.includes(c))) return false;
  return true;
};

// Preference → how well a place suits one member (0..1); unknown place data counts 0.7
const memberFit = (w, place) => {
  const parts = [];
  if (w.diet === 'veg' || w.diet === 'egg') parts.push(place.dietType == null ? 0.7 : place.dietType === 'non_veg' ? 0.3 : 1);
  if (w.budget) parts.push(place.priceLevel == null ? 0.7 : 1 - Math.max(0, place.priceLevel - w.budget) / 3);
  if (w.cuisineIds?.length) parts.push(!place.cuisineIds.length ? 0.7 : place.cuisineIds.some((c) => w.cuisineIds.includes(c)) ? 1 : 0.4);
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
};

const MIXED_DIET_BOOST = 0.05; // "places serving both veg & non-veg get a boost" (plan)

export const computeSuggestions = async (state, at = new Date()) => {
  const all = await configService.getAll();
  let centre;
  if (state.location.mode === 'spot') centre = { lat: state.location.lat, lng: state.location.lng };
  else {
    const points = state.members.map((m) => m.location).filter(Boolean);
    if (!points.length) return { error: 'MIDPOINT_NEEDS_LOCATIONS' };
    centre = await placeRepo.centroid(points);
  }

  const wants = (await Promise.all(state.members.map(memberWants))).filter(Boolean);
  const diets = new Set(wants.map((w) => w.diet).filter(Boolean));
  const mixedDiets = diets.has('non_veg') && (diets.has('veg') || diets.has('egg'));

  let radiusM = all.search_radius_m.start;
  let candidates = (await placeRepo.findCandidates({ ...centre, radiusM, at })).filter((c) => wants.every((w) => passesStrict(w, c)));
  if (candidates.length < 3) {
    radiusM = all.search_radius_m.relaxed;
    candidates = (await placeRepo.findCandidates({ ...centre, radiusM, at })).filter((c) => wants.every((w) => passesStrict(w, c)));
  }

  const scored = candidates.map((c) => {
    const fits = wants.map((w) => memberFit(w, c)).filter((f) => f != null);
    const groupFit = fits.length ? fits.reduce((a, b) => a + b, 0) / fits.length : null;
    const parts = ranking.scoreParts(c, { priorMean: all.bayes_prior.mean });
    if (c.distanceM != null) parts.distance = Math.max(0, 1 - c.distanceM / radiusM);
    if (groupFit != null) parts.taste = groupFit;
    const boost = mixedDiets && c.dietType === 'both' ? MIXED_DIET_BOOST : 0;
    return { c, groupFit, score: ranking.combine(parts, all.search_weights) + boost };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, all.group_suggestions);

  const hours = await placeRepo.findHoursForPlaces(top.map((s) => s.c.placeId));
  return {
    centre,
    suggestions: top.map(({ c, groupFit, score }) => {
      const opening = openingStatus(hours[c.placeId] ?? [], at);
      return {
        placeId: c.placeId,
        name: c.placeName,
        area: c.areaName,
        location: { lat: c.lat, lng: c.lng },
        distanceM: c.distanceM == null ? null : Math.round(c.distanceM),
        matchPct: groupFit == null ? null : Math.round(groupFit * 100),
        score: Math.round(score * 1000) / 1000,
        opening,
        reason: ranking.reasonFor(c, { opening }),
      };
    }),
  };
};

// Creator: "Get suggestions" — allowed once ≥ 2 members are ready
export const startSuggestions = async (code, memberId, at = new Date()) => {
  const check = await groupLiveRepo.update(code, (state) => {
    if (!findMember(state, memberId)) return { error: 'NOT_A_MEMBER' };
    if (state.creatorId !== memberId) return { error: 'NOT_CREATOR' };
    if (state.status !== 'joining') return { error: 'GROUP_NOT_JOINING' };
    if (state.members.filter((m) => m.ready).length < 2) return { error: 'NOT_ENOUGH_READY' };
    if (!state.location) return { error: 'LOCATION_REQUIRED' };
    state.status = 'choosing';
    return { state };
  });
  if (check.error) return fail(check.error);

  let computed;
  try {
    computed = await computeSuggestions(check.state, at);
  } catch (err) {
    await groupLiveRepo.update(code, (state) => ({ state: { ...state, status: 'joining' } }));
    throw err;
  }
  const out = await groupLiveRepo.update(code, (state) => {
    if (computed.error || !computed.suggestions.length) {
      state.status = 'joining';
      return { state, failure: computed.error ?? 'NO_SUGGESTIONS' };
    }
    state.status = 'voting';
    state.suggestions = computed.suggestions;
    state.votes = {};
    if (state.location.mode === 'midpoint') state.location = { ...state.location, ...computed.centre };
    return { state };
  });
  if (out.failure) return fail(out.failure);
  return ok(snapshot(out.state));
};

// ---- Voting + result -------------------------------------------------------------------

// Most votes wins; tie → higher match score (score); no votes → best suggestion.
export const pickWinner = (suggestions, votes) => {
  const counts = {};
  for (const placeId of Object.values(votes)) counts[placeId] = (counts[placeId] ?? 0) + 1;
  const ranked = [...suggestions].sort((a, b) => (counts[b.placeId] ?? 0) - (counts[a.placeId] ?? 0) || b.score - a.score);
  const winner = ranked[0];
  const top = counts[winner.placeId] ?? 0;
  const tied = suggestions.filter((s) => (counts[s.placeId] ?? 0) === top).length > 1;
  return { winner, votes: top, decidedBy: tied ? 'tie_break' : 'votes' };
};

// Ends the group inside the lock and returns what must be saved to Postgres
const finishState = (state, overridePlaceId) => {
  let decision;
  if (overridePlaceId) {
    const s = state.suggestions.find((x) => x.placeId === overridePlaceId);
    if (!s) return { error: 'NOT_A_SUGGESTION' };
    decision = { winner: s, votes: Object.values(state.votes).filter((v) => v === s.placeId).length, decidedBy: 'creator' };
  } else {
    decision = pickWinner(state.suggestions, state.votes);
  }
  state.status = 'done';
  state.result = {
    placeId: decision.winner.placeId,
    name: decision.winner.name,
    area: decision.winner.area,
    location: decision.winner.location,
    votes: decision.votes,
    decidedBy: decision.decidedBy,
    endedAt: new Date().toISOString(),
  };
  return { state, finished: true };
};

const saveHistory = async (state) => {
  const creator = state.members.find((m) => m.id === state.creatorId);
  await groupRepo.saveFinished({
    code: state.code,
    createdBy: creator?.userId ?? null,
    locationLabel: state.location?.label ?? (state.location?.mode === 'midpoint' ? 'Midpoint' : null),
    location: state.location?.lat != null ? { lat: state.location.lat, lng: state.location.lng } : null,
    winningPlaceId: state.result.placeId,
    guestCount: state.members.filter((m) => m.isGuest).length,
    startedAt: state.createdAt,
    endedAt: state.result.endedAt,
    members: state.members.filter((m) => m.userId).map((m) => ({ userId: m.userId, joinedAt: m.joinedAt })),
  });
};

// Re-vote replaces the old vote (votes stored as member → place). Everyone voted → ends automatically.
export const vote = async (code, memberId, placeId) => {
  const out = await groupLiveRepo.update(code, (state) => {
    if (!findMember(state, memberId)) return { error: 'NOT_A_MEMBER' };
    if (state.status !== 'voting') return { error: 'GROUP_NOT_VOTING' };
    if (!state.suggestions.some((s) => s.placeId === placeId)) return { error: 'NOT_A_SUGGESTION' };
    state.votes[memberId] = placeId;
    if (state.members.every((m) => m.id in state.votes)) return finishState(state);
    return { state };
  });
  if (out.error) return fail(out.error);
  if (out.finished) await saveHistory(out.state);
  return ok({ group: snapshot(out.state), finished: Boolean(out.finished) });
};

// Creator ends voting early, optionally picking the place (override)
export const finish = async (code, memberId, placeId = null) => {
  const out = await groupLiveRepo.update(code, (state) => {
    if (!findMember(state, memberId)) return { error: 'NOT_A_MEMBER' };
    if (state.creatorId !== memberId) return { error: 'NOT_CREATOR' };
    if (state.status !== 'voting') return { error: 'GROUP_NOT_VOTING' };
    return finishState(state, placeId);
  });
  if (out.error) return fail(out.error);
  await saveHistory(out.state);
  return ok({ group: snapshot(out.state), finished: true });
};

// Leave: vote removed; creator leaving → next member by join order; last one out → group deleted.
export const leave = async (code, memberId) => {
  const out = await groupLiveRepo.update(code, (state) => {
    if (!findMember(state, memberId)) return { error: 'NOT_A_MEMBER' };
    state.members = state.members.filter((m) => m.id !== memberId);
    delete state.votes[memberId];
    if (!state.members.length) return { state: null, deleted: true };
    if (state.creatorId === memberId) state.creatorId = nextCreator(state);
    if (state.status === 'voting' && state.members.every((m) => m.id in state.votes) && Object.keys(state.votes).length) {
      return finishState(state);
    }
    return { state };
  });
  if (out.error) return fail(out.error);
  if (out.deleted) return ok({ group: null, finished: false });
  if (out.finished) await saveHistory(out.state);
  return ok({ group: snapshot(out.state), finished: Boolean(out.finished) });
};
