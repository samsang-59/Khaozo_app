// Where the user is eating: phone location (asked on first visit) or an area pin from the
// picker (when location is denied, or chosen on purpose). The choice is remembered.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAreas } from '@/api/meta.api.js';
import { local } from '@/lib/storage.js';

const LocationContext = createContext(null);
const STORE_KEY = 'kz.location'; // { mode: 'gps' | 'area', area?: { id, name, lat, lng } }

const toRad = (d) => (d * Math.PI) / 180;
export const distanceM = (a, b) => {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Bhubaneswar centre — used only before anything else is known
export const CITY_CENTRE = { lat: 20.2961, lng: 85.8245 };

export function LocationProvider({ children }) {
  const stored = local.get(STORE_KEY);
  const [mode, setMode] = useState(stored?.mode ?? null); // null = never asked
  const [area, setArea] = useState(stored?.area ?? null);
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | asking | granted | denied | unavailable
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: areas = [] } = useQuery({ queryKey: ['meta', 'areas'], queryFn: listAreas, staleTime: 24 * 3600 * 1000 });

  useEffect(() => {
    local.set(STORE_KEY, mode ? { mode, area } : null);
  }, [mode, area]);

  const askLocation = useCallback(
    () =>
      new Promise((resolve) => {
        if (!('geolocation' in navigator)) {
          setStatus('unavailable');
          return resolve(null);
        }
        setStatus('asking');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCoords(c);
            setStatus('granted');
            setMode('gps');
            resolve(c);
          },
          () => {
            setStatus('denied');
            setMode((m) => (m === 'gps' ? (area ? 'area' : null) : m));
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
        );
      }),
    [area],
  );

  // Returning visitor who chose GPS before → quietly get a fresh fix
  useEffect(() => {
    if (stored?.mode === 'gps') askLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseArea = useCallback((a) => {
    setArea(a ? { id: a.id, name: a.name, lat: a.lat, lng: a.lng } : null);
    setMode(a ? 'area' : null);
    setPickerOpen(false);
  }, []);

  const nearestArea = useMemo(() => {
    if (!coords || !areas.length) return null;
    let best = null;
    for (const a of areas) {
      const d = distanceM(coords, a);
      if (!best || d < best.d) best = { ...a, d };
    }
    return best;
  }, [coords, areas]);

  // What searches use: GPS point, else the chosen area pin
  const centre = mode === 'gps' && coords ? coords : mode === 'area' && area ? { lat: area.lat, lng: area.lng } : null;
  const label = mode === 'gps' && coords ? (nearestArea?.name ?? 'Near me') : (area?.name ?? 'Pick area');

  const value = useMemo(
    () => ({
      mode,
      area,
      coords,
      status,
      centre,
      label,
      areas,
      hasChoice: !!centre,
      needsPicker: !centre && (status === 'denied' || status === 'unavailable' || mode === null),
      askLocation,
      chooseArea,
      pickerOpen,
      openPicker: () => setPickerOpen(true),
      closePicker: () => setPickerOpen(false),
    }),
    [mode, area, coords, status, centre, label, areas, askLocation, chooseArea, pickerOpen],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export const useUserLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useUserLocation must be used inside <LocationProvider>');
  return ctx;
};
