import { useRouteError } from 'react-router';

// Last-resort error page (outside the providers, so plain markup only)
export default function RouteError() {
  const err = useRouteError();
  console.error('[router]', err);
  return (
    <div className="flex min-h-dvh flex-col justify-center gap-4 bg-saffron px-6">
      <p className="font-display text-3xl font-extrabold">khaozo</p>
      <h1 className="text-4xl leading-none tracking-[-0.03em]">Something went wrong.</h1>
      <a href="/" className="w-fit rounded-xl border-2 border-ink bg-ink px-5 py-3 font-extrabold text-cream no-underline">
        Go home
      </a>
    </div>
  );
}
