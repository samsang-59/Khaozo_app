// Pop-up sheet: bottom sheet on phone (drag down / scrim tap to close), centred dialog on
// laptop (Esc / ✕). Both trap focus. title is always rendered for screen readers.
import * as Dialog from '@radix-ui/react-dialog';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { useIsLaptop } from '@/hooks/useMediaQuery.js';
import { cn } from '@/lib/cn.js';

export function Sheet({ open, onOpenChange, title, subtitle, badge, children, footer, className, hideTitle = false, dark = false }) {
  const laptop = useIsLaptop();

  const header = (Title, Description) => (
    <div className={cn('flex items-start justify-between gap-3', hideTitle && 'sr-only')}>
      <div className="min-w-0">
        <Title className="font-display text-[26px] leading-[1.05] font-extrabold tracking-[-0.03em] lg:text-[30px]">{title}</Title>
        {subtitle ? (
          <Description className="mt-1 text-[13px] font-bold text-body">{subtitle}</Description>
        ) : (
          <Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</Description>
        )}
      </div>
      {badge}
    </div>
  );

  if (laptop) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/55" />
          <Dialog.Content
            className={cn(
              'fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[22px] border-2 border-ink bg-cream shadow-hard-lg outline-none',
              className,
            )}
          >
            <div className="flex items-start gap-3 px-7 pt-7">
              <div className="min-w-0 flex-1">{header(Dialog.Title, Dialog.Description)}</div>
              <Dialog.Close className="press inline-flex size-9 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-card" aria-label="Close">
                <X className="size-4" strokeWidth={3} />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-7 pt-4 pb-2">{children}</div>
            {footer && <div className="px-7 pt-2 pb-7">{footer}</div>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-scrim/90" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[26px] border-t-2 border-ink outline-none',
            dark ? 'bg-ink text-cream' : 'bg-cream',
            className,
          )}
        >
          <div className="mx-auto mt-3 mb-1 h-[5px] w-11 shrink-0 rounded-full bg-ink" aria-hidden />
          <div className="px-5 pt-3">{header(Drawer.Title, Drawer.Description)}</div>
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">{children}</div>
          {footer && <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
