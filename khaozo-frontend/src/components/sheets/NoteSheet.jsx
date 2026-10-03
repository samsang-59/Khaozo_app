// Private note on a place or a dish — "ONLY YOU SEE THIS". Delete / Save.
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createNote, deleteNote, updateNote } from '@/api/notes.api.js';
import { Sheet } from '@/components/ui/Sheet.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Textarea } from '@/components/ui/Input.jsx';
import { Badge } from '@/components/ui/Badge.jsx';
import { toast, toastError } from '@/components/ui/toast.jsx';

// target: { placeId } | { menuItemId } · existing: the note (if any) · subtitle: place / dish name
export default function NoteSheet({ open, onOpenChange, target, existing, subtitle }) {
  const [text, setText] = useState(existing?.text ?? '');
  const qc = useQueryClient();
  useEffect(() => {
    if (open) setText(existing?.text ?? '');
  }, [open, existing]);

  const done = (msg) => {
    qc.invalidateQueries({ queryKey: ['me', 'notes'] });
    onOpenChange(false);
    toast.success(msg);
  };
  const save = useMutation({
    mutationFn: () => (existing ? updateNote(existing.id, text.trim()) : createNote({ ...target, text: text.trim() })),
    onSuccess: () => done('Note saved'),
    onError: toastError,
  });
  const remove = useMutation({
    mutationFn: () => deleteNote(existing.id),
    onSuccess: () => done('Note deleted'),
    onError: toastError,
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Note"
      subtitle={subtitle}
      badge={<Badge tone="outline" className="mt-1 shrink-0 border-2 px-2 py-0.5">Only you see this</Badge>}
      footer={
        <div className="flex gap-2.5">
          {existing && (
            <Button size="lg" className="w-[110px]" loading={remove.isPending} onClick={() => remove.mutate()}>
              Delete
            </Button>
          )}
          <Button variant="primary" size="lg" className="flex-1" disabled={!text.trim()} loading={save.isPending} onClick={() => save.mutate()}>
            Save note
          </Button>
        </div>
      }
    >
      <div className="pb-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder="Ask for less oil. Go before 8 PM on Fridays…"
          className="min-h-[150px] shadow-hard-sm"
          aria-label="Note"
        />
      </div>
    </Sheet>
  );
}
