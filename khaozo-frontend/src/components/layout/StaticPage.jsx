// Privacy · Terms · About share one layout: saffron header, sticky table of contents on laptop
// (link list on phone), body Figtree 16/1.65, max 680px.
import { useEffect } from 'react';
import { BackButton } from './PageHeader.jsx';
import { cn } from '@/lib/cn.js';

export default function StaticPage({ title, subtitle, updated, sections, draft = false, children }) {
  useEffect(() => {
    document.title = `${title} — Khaozo`;
  }, [title]);
  return (
    <div>
      <div className="border-b-2 border-ink bg-saffron">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-5 pt-5 pb-7 lg:px-12 lg:pt-12 lg:pb-10">
          <BackButton fallback="/me" className="bg-cream lg:hidden" />
          <h1 className="text-[34px] leading-none tracking-[-0.03em] lg:text-[64px] lg:tracking-[-0.04em]">{title}</h1>
          {subtitle && <p className="max-w-[560px] text-[15px] leading-snug font-bold">{subtitle}</p>}
          {updated && <p className="text-[13px] font-extrabold">Last updated {updated}</p>}
        </div>
      </div>
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-5 pt-6 pb-12 lg:flex-row lg:gap-14 lg:px-12 lg:pt-9">
        {sections?.length > 0 && (
          <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:w-[240px] lg:self-start">
            <ul className="overflow-hidden rounded-2xl border-2 border-ink bg-card [&>*+*]:border-t-2 [&>*+*]:border-ink">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className={cn('block px-4 py-2.5 text-sm font-extrabold no-underline hover:bg-mixed', i === 0 && 'lg:bg-ink lg:text-cream lg:hover:bg-ink')}>
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <article className="max-w-[680px] flex-1 text-base leading-[1.65] font-medium text-body [&_h2]:pt-2 [&_h2]:pb-2 [&_h2]:text-[26px] [&_h2]:leading-tight [&_h2]:text-ink [&_p+p]:pt-3 [&_section+section]:pt-6 [&_ul]:list-disc [&_ul]:pl-5">
          {draft && (
            <p className="mb-4 inline-block rounded-lg border-2 border-dashed border-ink bg-notice px-2.5 py-1 font-display text-xs font-extrabold tracking-[0.06em] text-ink uppercase">
              Draft · legal text to be supplied
            </p>
          )}
          {children}
        </article>
      </div>
    </div>
  );
}
