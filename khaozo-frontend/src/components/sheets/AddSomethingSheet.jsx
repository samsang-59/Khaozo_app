// "+" tab menu: Rate a dish (pick the place first) · Review a place · Add a missing place
import { useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useUi } from '@/context/UiContext.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { cn } from '@/lib/cn.js';

function Option({ title, sub, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'press flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-ink px-4 py-3.5 text-left',
        tone === 'primary' && 'bg-saffron shadow-hard',
        tone === 'plain' && 'bg-card',
        tone === 'dashed' && 'border-dashed bg-card',
      )}
    >
      <span>
        <span className="block font-display text-lg leading-tight font-extrabold tracking-[-0.02em]">{title}</span>
        <span className="block text-[13px] font-bold">{sub}</span>
      </span>
      <ArrowRight className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
    </button>
  );
}

export default function AddSomethingSheet() {
  const { addMenuOpen, setAddMenuOpen, setPlacePicker } = useUi();
  const { gate } = useAuth();
  const navigate = useNavigate();
  const close = () => setAddMenuOpen(false);

  const pickPlace = (kind) => {
    close();
    gate(`add:${kind}`, () => setPlacePicker(kind));
  };

  return (
    <Sheet open={addMenuOpen} onOpenChange={setAddMenuOpen} title="Add something">
      <div className="flex flex-col gap-3 pb-4">
        <Option tone="primary" title="Rate a dish" sub="Pick the place first" onClick={() => pickPlace('rate')} />
        <Option tone="plain" title="Review a place" sub="Stars, good-for tags" onClick={() => pickPlace('review')} />
        <Option
          tone="dashed"
          title="Add a missing place"
          sub="Drop a pin, add the name"
          onClick={() => {
            close();
            navigate('/places/new');
          }}
        />
      </div>
    </Sheet>
  );
}
