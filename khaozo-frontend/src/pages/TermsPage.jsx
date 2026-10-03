// Terms `/terms` — same layout as Privacy. DRAFT copy.
import StaticPage from '@/components/layout/StaticPage.jsx';

const SECTIONS = [
  { id: 'use', title: 'Using Khaozo' },
  { id: 'content', title: 'Your ratings & photos' },
  { id: 'places', title: 'Place information' },
  { id: 'accounts', title: 'Accounts' },
];

export default function TermsPage() {
  return (
    <StaticPage title="Terms" updated="3 Oct 2026" sections={SECTIONS} draft>
      <section id="use">
        <h2>Using Khaozo</h2>
        <p>Khaozo helps you find what to order and where in Bhubaneswar, from ratings by people who ate there. Please rate honestly — only dishes you actually had.</p>
      </section>
      <section id="content">
        <h2>Your ratings & photos</h2>
        <p>You keep ownership of what you post. By posting you let Khaozo show it in the app. Don't post photos of people without their permission, or anything abusive. Admins may remove content that breaks these rules.</p>
      </section>
      <section id="places">
        <h2>Place information</h2>
        <p>Place data comes from OpenStreetMap, Foursquare Open Places and Khaozo users. Hours and menus can be out of date — report a problem on the place page when you spot one.</p>
      </section>
      <section id="accounts">
        <h2>Accounts</h2>
        <p>Sign-in is with Google only. You can delete your account at any time from Settings.</p>
      </section>
    </StaticPage>
  );
}
