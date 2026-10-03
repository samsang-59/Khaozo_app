// About `/about` — what Khaozo is + data credits (OSM attribution, ODbL; Foursquare OS Places, Apache 2.0)
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import StaticPage from '@/components/layout/StaticPage.jsx';
import { ListCard } from '@/components/ui/Card.jsx';

function Credit({ title, children }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[15px] font-extrabold text-ink">{title}</p>
      <p className="text-[13px] leading-snug font-bold text-body">{children}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <StaticPage title="About khaozo" subtitle="Dish-level ratings for Bhubaneswar, from the people who ate there.">
      <div className="flex flex-col gap-4">
        <h2>Data and credits</h2>
        <ListCard>
          <Credit title="Maps">
            ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="link-plain">
              OpenStreetMap contributors
            </a>
          </Credit>
          <Credit title="Place data">
            OpenStreetMap (data under the{' '}
            <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noreferrer" className="link-plain">
              ODbL
            </a>
            ; the places dump is available on request) · Foursquare OS Places (Apache 2.0)
          </Credit>
          <Credit title="Ratings and photos">Khaozo diners</Credit>
        </ListCard>
        <ListCard>
          {[
            ['/privacy', 'Privacy policy'],
            ['/terms', 'Terms'],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="flex items-center justify-between px-4 py-3 text-[15px] font-extrabold text-ink no-underline hover:bg-mixed">
              {label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ))}
        </ListCard>
        <p className="font-mono text-xs">v1.0</p>
      </div>
    </StaticPage>
  );
}
