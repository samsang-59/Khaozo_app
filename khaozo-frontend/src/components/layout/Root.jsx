import { Suspense } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { AuthProvider, useAuth } from '@/context/AuthContext.jsx';
import { LocationProvider } from '@/context/LocationContext.jsx';
import { UiProvider } from '@/context/UiContext.jsx';
import AppShell from './AppShell.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { PageSkeleton, Splash } from './Splash.jsx';
import { Toaster } from '@/components/ui/toast.jsx';
import LoginSheet from '@/components/sheets/LoginSheet.jsx';
import AreaPickerSheet from '@/components/search/AreaPickerSheet.jsx';
import AddSomethingSheet from '@/components/sheets/AddSomethingSheet.jsx';
import PlacePickerSheet from '@/components/sheets/PlacePickerSheet.jsx';

function Ready() {
  const { ready } = useAuth();
  if (!ready) return <Splash />;
  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
      <LoginSheet />
      <AreaPickerSheet />
      <AddSomethingSheet />
      <PlacePickerSheet />
    </AppShell>
  );
}

export default function Root() {
  return (
    <AuthProvider>
      <LocationProvider>
        <UiProvider>
          <Ready />
          <Toaster />
          <ScrollRestoration />
        </UiProvider>
      </LocationProvider>
    </AuthProvider>
  );
}
