// Pick up to 3 photos; they're compressed in the browser before upload (≤ 1600px, < 1 MB).
import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { compressImage, isAcceptedImage, MAX_PHOTOS } from '@/lib/compressImage.js';
import { toast } from '@/components/ui/toast.jsx';

export function PhotoUploader({ files, onChange, max = MAX_PHOTOS }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const add = async (list) => {
    const picked = [...list].filter(isAcceptedImage).slice(0, max - files.length);
    if (list.length && !picked.length) return toast.error('Only images (JPG, PNG, WebP, HEIC) can be added.');
    setBusy(true);
    try {
      const out = [];
      for (const f of picked) out.push(Object.assign(await compressImage(f), { preview: URL.createObjectURL(f) }));
      onChange([...files, ...out]);
    } catch {
      toast.error("Couldn't read that photo. Try another one.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f, i) => (
        <div key={f.preview ?? i} className="relative size-16 overflow-hidden rounded-xl border-2 border-ink">
          <img src={f.preview} alt="" className="size-full object-cover" />
          <button
            type="button"
            aria-label="Remove photo"
            onClick={() => onChange(files.filter((_, j) => j !== i))}
            className="absolute top-0.5 right-0.5 rounded-md border-2 border-ink bg-card p-0.5"
          >
            <X className="size-3" strokeWidth={3} />
          </button>
        </div>
      ))}
      {files.length < max && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="press flex h-16 min-w-16 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink px-3 text-[13px] font-extrabold"
        >
          <Camera className="size-4" aria-hidden /> {busy ? 'Adding…' : `+ Photo (max ${max})`}
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden onChange={(e) => add(e.target.files)} />
    </div>
  );
}
