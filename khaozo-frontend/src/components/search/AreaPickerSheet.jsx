import { useUserLocation } from '@/context/LocationContext.jsx';
import { Sheet } from '@/components/ui/Sheet.jsx';
import AreaPicker from './AreaPicker.jsx';

export default function AreaPickerSheet() {
  const { pickerOpen, closePicker } = useUserLocation();
  return (
    <Sheet open={pickerOpen} onOpenChange={(o) => !o && closePicker()} title="Where are you eating?" subtitle="Pick an area, or turn on location for distances from where you are.">
      <div className="pb-4">
        <AreaPicker onDone={closePicker} />
      </div>
    </Sheet>
  );
}
