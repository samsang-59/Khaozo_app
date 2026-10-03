// Share a link: native share sheet on phones, WhatsApp link, or copy.
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { toast } from '@/components/ui/toast.jsx';

export const shareLink = async ({ url, title, text }) => {
  if (navigator.share) {
    try {
      await navigator.share({ url, title, text });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch {
    window.prompt('Copy this link', url);
  }
};

export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export function WhatsAppButton({ text, className, children = 'Share on WhatsApp', size = 'lg' }) {
  return (
    <a href={whatsappUrl(text)} target="_blank" rel="noreferrer" className={`press inline-flex items-center justify-center rounded-xl border-2 border-ink bg-green px-4 font-extrabold text-card no-underline shadow-hard-sm ${size === 'lg' ? 'h-[52px]' : 'h-11'} ${className ?? ''}`}>
      {children}
    </a>
  );
}

export function CopyLinkButton({ url, className, children = 'Copy link' }) {
  return (
    <Button
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Link copied');
        } catch {
          window.prompt('Copy this link', url);
        }
      }}
    >
      <Copy className="size-4" aria-hidden /> {children}
    </Button>
  );
}
