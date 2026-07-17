'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const NAV = [
  { href: '/',         glyph: 'HOM', label: 'Home'         },
  { href: '/dataroom', glyph: 'DAT', label: 'Dataroom'     },
  { href: '/timeline', glyph: 'RAC', label: 'The Race'     },
  { href: '/h2h',      glyph: 'H2H', label: 'Head to Head' },
  { href: '/spray',    glyph: 'SPR', label: 'Spray Charts' },
  { href: '/roster',   glyph: 'ROS', label: 'Rosters'      },
  { href: '/draft',    glyph: 'DFT', label: 'Draft Room'   },
  { href: '/pool',     glyph: 'POL', label: 'Player Pool'  },
];

// MLB's "today" runs on Eastern Time, not the visitor's local clock or UTC —
// using UTC (as this used to) rolls the day over mid-evening ET, which is
// exactly when night games are live, so it would undercount recent HRs and
// then "correct" itself after midnight UTC. Compute the actual ET calendar
// day's UTC bounds, DST included.
function getEtDayBoundsUtc(): { startIso: string; endIso: string } {
  const now = new Date();
  const etDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD in ET

  const offsetName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', timeZoneName: 'shortOffset', hour: '2-digit',
  }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? 'GMT-5';
  const offsetHours = parseInt(offsetName.replace('GMT', '') || '-5', 10);
  const sign = offsetHours >= 0 ? '+' : '-';
  const offsetStr = `${sign}${String(Math.abs(offsetHours)).padStart(2, '0')}:00`;

  const start = new Date(`${etDateStr}T00:00:00${offsetStr}`);
  const end   = new Date(start.getTime() + 24 * 3_600_000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function LivePill() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const { startIso, endIso } = getEtDayBoundsUtc();

    supabase
      .from('home_runs')
      .select('id', { count: 'exact', head: true })
      .gte('hit_at', startIso)
      .lt('hit_at', endIso)
      .then(({ count: c }) => { if (c != null) setCount(c); });

    const channel = supabase
      .channel('navbar-hr-inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'home_runs' }, () => {
        setCount(n => n + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="livepill">
      <span className="livedot" />
      <span className="livepill-label">LIVE</span>
      <span className="livecount">{count}</span>
    </div>
  );
}

export default function NavBar() {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [path]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <header className="topbar">
      <div className="topbar-inner">

        {/* Left: brand */}
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <svg viewBox="0 0 32 32" width="28" height="28">
              <circle cx="16" cy="16" r="14" fill="var(--c-bone)" stroke="var(--c-foul)" strokeWidth="1.5"/>
              <path d="M 6 22 Q 16 6 26 22"  stroke="var(--c-foul)" strokeWidth="1.2" fill="none"/>
              <path d="M 6 10 Q 16 26 26 10"  stroke="var(--c-foul)" strokeWidth="1.2" fill="none"/>
            </svg>
          </div>
          <div className="brand-stack">
            <div className="brand-name">DINGERS, PLEASE</div>
            <div className="brand-sub">EST. 2026 · POST-ASB</div>
          </div>
        </div>

        {/* Center: nav (desktop) */}
        <nav className="topnav" aria-label="Main navigation">
          {NAV.map(({ href, glyph, label }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={`navbtn${active ? ' is-active' : ''}`}
              >
                <span className="navbtn-glyph">{glyph}</span>
                <span className="navbtn-label">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: live pill + admin lock + mobile menu toggle */}
        <div className="topbar-right">
          <LivePill />
          <Link href="/admin" className="lock-btn" title="Commissioner admin" aria-label="Open admin">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="8" cy="10.5" r="1" fill="currentColor"/>
            </svg>
          </Link>
          <button
            className={`menu-toggle${menuOpen ? ' is-open' : ''}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
          >
            <span className="menu-bar" />
            <span className="menu-bar" />
            <span className="menu-bar" />
          </button>
        </div>

      </div>

      {/* Mobile drawer nav */}
      <div className={`mobile-nav-backdrop${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(false)} />
      <nav className={`mobile-nav${menuOpen ? ' is-open' : ''}`} aria-label="Mobile navigation">
        {NAV.map(({ href, glyph, label }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`mobile-navlink${active ? ' is-active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <span className="navbtn-glyph">{glyph}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
