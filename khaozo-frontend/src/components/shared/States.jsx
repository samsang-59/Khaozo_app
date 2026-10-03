import { Button } from '@/components/ui/Button.jsx';
import { cn } from '@/lib/cn.js';

// "STATE · EMPTY" card from the design: title, message, actions
export function EmptyState({ title, message, children, className, label }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border-2 border-ink bg-card p-5', className)}>
      {label && <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">{label}</p>}
      <h2 className="text-[22px] leading-[1.1] tracking-[-0.02em]">{title}</h2>
      {message && <p className="text-sm font-medium text-body">{message}</p>}
      {children && <div className="flex flex-wrap gap-2.5 pt-1">{children}</div>}
    </div>
  );
}

export function ErrorState({ title = "Couldn't load this", message, onRetry, retryLabel = 'Try again', className }) {
  return (
    <EmptyState title={title} message={message ?? 'Check your connection and try again.'} className={className}>
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </EmptyState>
  );
}
