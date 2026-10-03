// Group preferences — "Use my taste profile" (signed in) or choose for this outing: food,
// budget per person, cravings (cuisines), what you can't compromise on, and sharing your
// location for the fair midpoint. "I'm ready" sends it. Only a summary is shown to others.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listCuisines } from '@/api/meta.api.js';
import { useUserLocation } from '@/context/LocationContext.jsx';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Switch } from '@/components/ui/Switch.jsx';
import { Segmented } from '@/components/ui/Segmented.jsx';
import { ChoiceChips } from '@/components/inputs/ChoiceChips.jsx';
import { toast } from '@/components/ui/toast.jsx';

const DIETS = [
  { value: 'veg', label: 'Veg only' },
  { value: 'egg', label: 'Egg OK' },
  { value: 'non_veg', label: 'Non-veg OK' },
];
const BUDGETS = [
  { value: 1, label: '₹150' },
  { value: 2, label: '₹300' },
  { value: 3, label: '₹600' },
  { value: 0, label: 'Any' },
];
const STRICT = [
  { value: 'diet', label: 'Food' },
  { value: 'budget', label: 'Budget' },
  { value: 'cuisines', label: 'Craving' },
];

export function PreferencesSheet({ open, onOpenChange, signedIn, onSubmit, submitting }) {
  const { coords, centre, askLocation } = useUserLocation();
  const [useProfile, setUseProfile] = useState(signedIn);
  const [diet, setDiet] = useState(null);
  const [budget, setBudget] = useState(2);
  const [cuisineIds, setCuisineIds] = useState([]);
  const [strict, setStrict] = useState([]);
  const [shareLoc, setShareLoc] = useState(true);
  const cuisines = useQuery({ queryKey: ['meta', 'cuisines'], queryFn: listCuisines, staleTime: 24 * 3600 * 1000, enabled: open });

  useEffect(() => {
    if (open) setUseProfile(signedIn);
  }, [open, signedIn]);

  const submit = async () => {
    let location;
    if (shareLoc) {
      location = coords ?? (await askLocation()) ?? centre ?? undefined;
      if (!location) toast.info("Couldn't get your location — the host can still pick a spot.");
    }
    const prefs = useProfile
      ? { mode: 'profile' }
      : { mode: 'for_now', diet, budget: budget || null, cuisineIds };
    prefs.strict = Object.fromEntries(strict.map((k) => [k, true]));
    if (location) prefs.location = { lat: location.lat, lng: location.lng };
    onSubmit(prefs);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="What do you want?"
      subtitle="Others only see that you're ready — not what you picked."
      footer={
        <Button variant="primary" size="lg" block loading={submitting} onClick={submit}>
          I'm ready
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {signedIn && (
          <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink bg-card px-3.5 py-3">
            <span className="text-sm font-extrabold">Use my taste profile</span>
            <Switch label="Use my taste profile" checked={useProfile} onChange={setUseProfile} />
          </div>
        )}
        {!useProfile && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-extrabold">Craving</p>
              <ChoiceChips multi options={(cuisines.data ?? []).map((c) => ({ value: c.id, label: c.name }))} value={cuisineIds} onChange={setCuisineIds} label="Craving" size="sm" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-extrabold">Budget per person</p>
              <Segmented block size="md" label="Budget per person" value={budget} onChange={setBudget} options={BUDGETS} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-extrabold">Food</p>
              <ChoiceChips options={DIETS} value={diet} onChange={setDiet} label="Food" />
            </div>
          </>
        )}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-extrabold">Can't compromise on</p>
          <ChoiceChips multi options={STRICT} value={strict} onChange={setStrict} label="Can't compromise on" size="sm" />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink bg-card px-3.5 py-3">
          <span>
            <span className="block text-sm font-extrabold">Share my location</span>
            <span className="block text-xs font-bold text-body">Used for everyone's midpoint, never shown</span>
          </span>
          <Switch label="Share my location" checked={shareLoc} onChange={setShareLoc} />
        </div>
      </div>
    </Sheet>
  );
}
