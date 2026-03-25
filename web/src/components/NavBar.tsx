'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/',         label: '🏆 Standings' },
  { href: '/timeline', label: '📈 The Race'   },
  { href: '/spray',    label: '💥 Spray'      },
  { href: '/roster',   label: '📋 Rosters'    },
  { href: '/h2h',      label: '⚔️  H2H'        },
];

export default function NavBar() {
  const path = usePathname();

  return (
    <nav className="border-b border-[#2a2a2a] bg-[#0d0d0d] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-12 overflow-x-auto">
        {NAV.map(({ href, label }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                'px-3 py-1.5 rounded text-sm whitespace-nowrap transition-colors',
                active
                  ? 'bg-[#1e1e1e] text-[#f5c518] font-semibold'
                  : 'text-[#888] hover:text-[#e8e8e8] hover:bg-[#161616]',
              ].join(' ')}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
