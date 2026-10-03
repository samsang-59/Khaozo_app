// Draggable pin (starts at the user's location). Tap the map to move it too.
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/lib/cn.js';

const pin = L.divIcon({ className: '', html: '<div class="kz-pin" style="width:30px;height:30px;border-radius:8px;box-shadow:3px 3px 0 #141210"></div>', iconSize: [30, 30], iconAnchor: [15, 15] });

function ClickToMove({ onChange }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Recentre({ value }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!map.getBounds().contains([value.lat, value.lng])) map.panTo([value.lat, value.lng]);
  }, [value, map]);
  return null;
}

export default function PinPicker({ value, onChange, className, caption = 'Drag pin to the exact spot' }) {
  const handlers = useMemo(() => ({ dragend: (e) => onChange(e.target.getLatLng()) }), [onChange]);
  return (
    <div className={cn('relative isolate overflow-hidden rounded-[18px] border-2 border-ink bg-map shadow-hard', className)}>
      <MapContainer center={[value.lat, value.lng]} zoom={17} className="size-full" attributionControl>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' maxZoom={19} />
        <Marker position={[value.lat, value.lng]} icon={pin} draggable eventHandlers={handlers} keyboard autoPan />
        <ClickToMove onChange={(p) => onChange(p)} />
        <Recentre value={value} />
      </MapContainer>
      <span className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border-2 border-ink bg-card px-2 py-0.5 text-xs font-extrabold">{caption}</span>
    </div>
  );
}
