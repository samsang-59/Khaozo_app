// Toasts (sonner, unstyled + our own look):
// success = ink bg, cream text, saffron shadow (+ saffron action link)
// warn (429 "Slow down a bit") = amber · neutral ("Reconnecting…") = white bordered
import { Toaster as Sonner, toast as sonner } from 'sonner';

const base = 'flex w-full items-center gap-3 rounded-xl border-2 border-ink px-4 py-3 font-sans text-[15px] font-bold';

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={96}
      mobileOffset={{ bottom: 96 }}
      visibleToasts={3}
      toastOptions={{ unstyled: true, classNames: { toast: 'w-[min(420px,calc(100vw-32px))]' } }}
    />
  );
}

const render = (cls, message, action) =>
  sonner.custom((id) => (
    <div className={`${base} ${cls}`} role="status">
      <span className="flex-1">{message}</span>
      {action && (
        <button
          type="button"
          className="font-extrabold text-saffron underline decoration-2 underline-offset-2"
          onClick={() => {
            action.onClick();
            sonner.dismiss(id);
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  ));

export const toast = {
  success: (message, action) => render('bg-ink text-cream shadow-hard-saffron', message, action),
  warn: (message) => render('bg-amber text-ink shadow-hard', message),
  info: (message) => render('bg-card text-ink', message),
  error: (message) => render('bg-card text-ink shadow-hard', message),
  dismiss: sonner.dismiss,
};

// Errors from the API → the right toast (429 gets the amber "Slow down a bit")
export const toastError = (err) => {
  if (err?.code === 'RATE_LIMITED' || err?.status === 429) return toast.warn('Slow down a bit');
  return toast.error(err?.message ?? 'Something went wrong.');
};
