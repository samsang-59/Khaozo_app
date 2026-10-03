// Browser storage wrappers that never throw (private mode, blocked storage).
export const safeGet = (store, key) => {
  try {
    return JSON.parse(store.getItem(key));
  } catch {
    return null;
  }
};
export const safeSet = (store, key, value) => {
  try {
    if (value === null || value === undefined) store.removeItem(key);
    else store.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — fine, it's only a convenience */
  }
};
export const local = {
  get: (k) => safeGet(globalThis.localStorage, k),
  set: (k, v) => safeSet(globalThis.localStorage, k, v),
};
export const session = {
  get: (k) => safeGet(globalThis.sessionStorage, k),
  set: (k, v) => safeSet(globalThis.sessionStorage, k, v),
};
