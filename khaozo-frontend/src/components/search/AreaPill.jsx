import { ChevronDown } from 'lucide-react';
import { useUserLocation } from '@/context/LocationContext.jsx';

// "Patia ▾" — always opens the area picker
export default function AreaPill() {
  const { label, openPicker } = useUserLocation();
  return (
    <button
      type="button"
      onClick={openPicker}
      className="press inline-flex items-center gap-1 rounded-full border-2 border-ink bg-cream py-1 pr-2.5 pl-3 text-[13px] font-bold"
      aria-label={`Area: ${label}. Change area`}
    >
      {label}
      <ChevronDown className="size-3.5" strokeWidth={3} aria-hidden />
    </button>
  );
}
