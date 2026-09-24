import { Asset } from '@/components/media/Asset';
import { EveningDirector } from './EveningDirector';

const CHAPTERS = [
  {
    time: '5:00',
    meridiem: 'pm',
    name: 'Aperitivo',
    title: 'The first drink is bitter, on purpose.',
    body: 'Negronis on the bar, warm olives, the windows still holding a little daylight. Half-price spritzes until six.',
    asset: 'negroniPaper',
    href: '/menu#cocktails',
    cta: 'The bar list',
  },
  {
    time: '7:30',
    meridiem: 'pm',
    name: 'Dinner',
    title: 'Pasta rolled this afternoon. Plates meant to be passed.',
    body: 'Rigatoni in vodka sauce, Sunday meatballs, a whole branzino for the table. Order more than you need.',
    asset: 'pastaNight',
    href: '/menu',
    cta: 'The menu',
  },
  {
    time: '9:30',
    meridiem: 'pm',
    name: 'The Listening Room',
    title: 'A record on, a martini stirred very cold.',
    body: 'Thursdays through Saturdays the back room turns: soul, Italo and jazz on vinyl, a second round nobody planned.',
    asset: 'barNight',
    href: '/events',
    cta: 'What’s on',
  },
  {
    time: '11:45',
    meridiem: 'pm',
    name: 'Late',
    title: 'The candles are shorter. Nobody is in a hurry.',
    body: 'Amaro, affogato, one more song. The kitchen keeps a late menu going until the room decides it is done.',
    asset: 'roomDetail',
    href: '/reservations',
    cta: 'Find your table',
  },
] as const;

export function Evening() {
  return (
    <EveningDirector>
      <div className="cn-ev-frame">
        <header className="cn-ev-head cn-wrap">
          <div>
            <p className="cn-eyebrow">An evening at Casa Aurelia</p>
            <h2 id="evening-title" className="cn-display cn-md mt-4">
              The night gets better <em>the longer you stay.</em>
            </h2>
          </div>
          <div className="cn-ev-clock" aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="47" />
              {Array.from({ length: 12 }, (_, i) => (
                <line key={i} x1="50" y1="7" x2="50" y2={i % 3 === 0 ? 14 : 11} transform={`rotate(${i * 30} 50 50)`} />
              ))}
              <line className="cn-ev-hand-hour" x1="50" y1="50" x2="50" y2="28" transform="rotate(150 50 50)" />
              <line className="cn-ev-hand-minute" x1="50" y1="50" x2="50" y2="14" />
              <circle cx="50" cy="50" r="2.4" className="cn-ev-pin" />
            </svg>
            <div className="cn-ev-times">
              {CHAPTERS.map((chapter) => (
                <span key={chapter.time} className="cn-ev-time-label cn-num">
                  {chapter.time}
                  <small>{chapter.meridiem}</small>
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="cn-ev-viewport">
          <ol className="cn-ev-track">
            {CHAPTERS.map((chapter, index) => (
              <li key={chapter.name} className="cn-ev-chapter" data-m>
                <div className="cn-ev-photo-frame">
                  <div className="cn-ev-photo">
                    <Asset id={chapter.asset} rounded={false} sizes="(min-width: 900px) 34vw, 92vw" className="size-full" />
                  </div>
                </div>
                <div className="cn-ev-copy">
                  <p className="cn-ev-index cn-num">
                    <span>{String(index + 1).padStart(2, '0')}</span> {chapter.time}
                    {chapter.meridiem} — {chapter.name}
                  </p>
                  <h3 className="cn-display cn-sm">{chapter.title}</h3>
                  <p className="cn-body">{chapter.body}</p>
                  <a href={chapter.href} className="cn-link">
                    {chapter.cta} <span aria-hidden="true">→</span>
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="cn-ev-progress cn-wrap" aria-hidden="true">
          <i />
        </div>
      </div>
    </EveningDirector>
  );
}
