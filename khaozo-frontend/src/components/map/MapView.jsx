// Leaflet + OSM tiles in a bordered card. Pins = saffron squares; the selected / hovered
// pin shows a saffron label ("₹220 · 4.6★"). Optional "Search this area" button.
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/lib/cn.js';

const pinIcon = (cls = '') => L.divIcon({ className: '', html: `<div class="kz-pin ${cls}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
const labelIcon = (text, white = false) =>
  L.divIcon({ className: '', html: `<div class="kz-pin-label ${white ? 'is-white' : ''}">${text}</div>`, iconSize: [0, 0], iconAnchor: [0, 0] });
const meIcon = L.divIcon({ className: '', html: '<div class="kz-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function FitBounds({ points, centre }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    const all = [...points, ...(centre ? [centre] : [])];
    if (all.length === 0) return;
    if (all.length === 1) map.setView([all[0].lat, all[0].lng], 15);
    else map.fitBounds(L.latLngBounds(all.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function MoveWatcher({ onMove }) {
  useMapEvents({ moveend: (e) => onMove?.(e.target.getCenter()) });
  return null;
}

// pins: [{ id, lat, lng, label?, tone? }] · activeId: highlighted pin
export default function MapView({ pins = [], centre, activeId, onPinClick, onSearchArea, className, children, interactive = true }) {
  const start = centre ?? pins[0] ?? { lat: 20.2961, lng: 85.8245 };
  const points = useMemo(() => pins.map((p) => ({ lat: p.lat, lng: p.lng })), [pins]);
  return (
    <div className={cn('relative isolate overflow-hidden rounded-[18px] border-2 border-ink bg-map', className)}>
      <MapContainer
        center={[start.lat, start.lng]}
        zoom={14}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        attributionControl
        className="size-full"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' maxZoom={19} />
        <FitBounds points={points} centre={centre} />
        {onSearchArea && <MoveWatcher onMove={onSearchArea.onMove} />}
        {centre && <Marker position={[centre.lat, centre.lng]} icon={meIcon} interactive={false} keyboard={false} />}
        {pins.map((p) =>
          p.id === activeId && p.label ? (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={labelIcon(escapeHtml(p.label))} zIndexOffset={1000} eventHandlers={{ click: () => onPinClick?.(p.id) }} />
          ) : p.alwaysLabel ? (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={labelIcon(escapeHtml(p.alwaysLabel), p.tone === 'white')} eventHandlers={{ click: () => onPinClick?.(p.id) }} />
          ) : (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.tone ? `is-${p.tone}` : '')} title={p.title} eventHandlers={{ click: () => onPinClick?.(p.id) }} />
          ),
        )}
        {children}
      </MapContainer>
      {onSearchArea?.visible && (
        <button
          type="button"
          onClick={onSearchArea.onClick}
          className="press absolute top-3 right-3 z-[500] rounded-[10px] border-2 border-ink bg-card px-3 py-1.5 text-[13px] font-bold"
        >
          Search this area
        </button>
      )}
    </div>
  );
}
