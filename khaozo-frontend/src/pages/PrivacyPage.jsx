// Privacy `/privacy` — needed for Google OAuth approval and the DPDP Act. DRAFT copy.
import StaticPage from '@/components/layout/StaticPage.jsx';

const SECTIONS = [
  { id: 'collect', title: 'What we collect' },
  { id: 'use', title: 'How we use it' },
  { id: 'location', title: 'Location' },
  { id: 'rights', title: 'Your rights (DPDP Act)' },
  { id: 'contact', title: 'Contact' },
];

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy policy" updated="3 Oct 2026" sections={SECTIONS} draft>
      <section id="collect">
        <h2>What we collect</h2>
        <p>When you sign in with Google we receive your name, email address and profile photo. When you rate a dish or review a place we store the rating, any text and photos you add, and the date.</p>
        <p>Guests in a group give only a display name, which is deleted when the group ends (at most 4 hours later). Private notes and your taste profile are visible only to you.</p>
      </section>
      <section id="use">
        <h2>How we use it</h2>
        <p>To show your journal, rank dishes, and suggest places that match your taste profile. Ratings feed the public rankings without your email ever being shown.</p>
        <p>Search sentences and review text may be sent to an AI service (Google Gemini) to understand searches and write short dish summaries. We never send your name, email or notes.</p>
      </section>
      <section id="location">
        <h2>Location</h2>
        <p>Your phone's location is sent with a search to find places near you and measure distances. It is never saved to your account; search results are cached for about 10 minutes on a coarse grid (~500 m). In group mode a shared location is used to find everyone's midpoint and is never shown to other members; the group's chosen spot is kept with its history.</p>
      </section>
      <section id="rights">
        <h2>Your rights (DPDP Act)</h2>
        <p>You can see and change your data in the app, make your journal private, and delete your account at any time from Settings → Delete account. Deleting removes your name, email, photo, journal, wishlist, notes, taste profile and photos; ratings and reviews stay without your name and without their text.</p>
      </section>
      <section id="contact">
        <h2>Contact</h2>
        <p>Questions or requests about your data: contact details to be added before launch.</p>
      </section>
    </StaticPage>
  );
}
