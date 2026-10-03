// All routes (22 pages). 🔐 pages sit behind AuthGate, 👑 behind AdminRoute.
// handle flags tell the AppShell what chrome a page wants.
import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import Root from './components/layout/Root.jsx';
import AuthGate from './components/layout/AuthGate.jsx';
import AdminRoute from './components/layout/AdminRoute.jsx';
import RouteError from './components/layout/RouteError.jsx';

const Home = lazy(() => import('./pages/HomePage.jsx'));
const Search = lazy(() => import('./pages/SearchPage.jsx'));
const Place = lazy(() => import('./pages/PlacePage.jsx'));
const Dish = lazy(() => import('./pages/DishPage.jsx'));
const BestForDish = lazy(() => import('./pages/BestForDishPage.jsx'));
const PublicJournal = lazy(() => import('./pages/PublicJournalPage.jsx'));
const JoinGroup = lazy(() => import('./pages/JoinGroupPage.jsx'));
const GroupRoom = lazy(() => import('./pages/GroupRoomPage.jsx'));
const Privacy = lazy(() => import('./pages/PrivacyPage.jsx'));
const Terms = lazy(() => import('./pages/TermsPage.jsx'));
const About = lazy(() => import('./pages/AboutPage.jsx'));
const Onboarding = lazy(() => import('./pages/OnboardingPage.jsx'));
const Journal = lazy(() => import('./pages/JournalPage.jsx'));
const Me = lazy(() => import('./pages/MePage.jsx'));
const Wishlist = lazy(() => import('./pages/WishlistPage.jsx'));
const Notes = lazy(() => import('./pages/NotesPage.jsx'));
const TasteProfile = lazy(() => import('./pages/TasteProfilePage.jsx'));
const Settings = lazy(() => import('./pages/SettingsPage.jsx'));
const DeleteAccount = lazy(() => import('./pages/DeleteAccountPage.jsx'));
const AddPlace = lazy(() => import('./pages/AddPlacePage.jsx'));
const GroupHub = lazy(() => import('./pages/GroupHubPage.jsx'));
const Admin = lazy(() => import('./pages/AdminPage.jsx'));
const NotFound = lazy(() => import('./pages/NotFoundPage.jsx'));

const authed = (el, title) => <AuthGate title={title}>{el}</AuthGate>;

// handle: { tab: active tab · tabBar: false hides the phone tab bar · topBar: false hides the
//           laptop top bar · topSearch: false hides the top-bar search (pages with a hero search) }
const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home />, handle: { tab: 'home', topSearch: false } },
      { path: '/search', element: <Search />, handle: { tab: 'home' } },
      { path: '/places/new', element: authed(<AddPlace />, 'Sign in to add a place'), handle: { tabBar: false } },
      { path: '/places/:id', element: <Place />, handle: { tab: 'home' } },
      { path: '/menu-items/:id', element: <Dish />, handle: { tab: 'home', tabBar: false } },
      { path: '/dishes/:id', element: <BestForDish />, handle: { tab: 'home' } },
      { path: '/u/:id', element: <PublicJournal />, handle: { tabBar: false, topBar: false } },
      { path: '/g/:code', element: <JoinGroup />, handle: { tab: 'group', tabBar: false } },
      { path: '/g/:code/room', element: <GroupRoom />, handle: { tab: 'group', tabBar: false } },
      { path: '/privacy', element: <Privacy />, handle: {} },
      { path: '/terms', element: <Terms />, handle: {} },
      { path: '/about', element: <About />, handle: { tab: 'me' } },
      { path: '/onboarding', element: authed(<Onboarding />, 'Sign in to set up your taste'), handle: { tabBar: false, topBar: false } },
      { path: '/journal', element: authed(<Journal />, 'Sign in to see your journal'), handle: { tab: 'journal' } },
      { path: '/me', element: authed(<Me />, 'Sign in to Khaozo'), handle: { tab: 'me' } },
      { path: '/wishlist', element: authed(<Wishlist />, 'Sign in to see your wishlist'), handle: { tab: 'me' } },
      { path: '/notes', element: authed(<Notes />, 'Sign in to see your notes'), handle: { tab: 'me' } },
      { path: '/profile/taste', element: authed(<TasteProfile />, 'Sign in to see your taste profile'), handle: { tab: 'me' } },
      { path: '/settings', element: authed(<Settings />, 'Sign in to change settings'), handle: { tab: 'me' } },
      { path: '/settings/delete', element: authed(<DeleteAccount />, 'Sign in first'), handle: { tab: 'me', tabBar: false } },
      { path: '/groups', element: authed(<GroupHub />, 'Sign in to start a group'), handle: { tab: 'group' } },
      { path: '/admin', element: <AdminRoute><Admin /></AdminRoute>, handle: { tabBar: false, topBar: false } },
      { path: '*', element: <NotFound />, handle: { tabBar: false, topBar: false } },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
