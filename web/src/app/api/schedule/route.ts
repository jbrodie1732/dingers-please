import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ESPN-style game ticker feed for the Home page.
//
// Proxies the same public MLB Stats API the watcher polls (statsapi.mlb.com) so
// the browser never calls it directly, and joins in each matchup's rostered
// (drafted) players by matching a player's MLB team abbreviation to the game's
// teams. "Today" is the MLB/Eastern calendar day.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BASE = 'https://statsapi.mlb.com';

function etDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Canonicalize team abbreviations so the pool's abbreviations and statsapi's
// line up even where the two use different conventions (AZ/ARI, CWS/CHW, …).
const ABBR_ALIAS: Record<string, string> = {
  AZ: 'ARI', ARI: 'ARI',
  CWS: 'CHW', CHW: 'CHW',
  KC: 'KCR', KCR: 'KCR',
  SD: 'SDP', SDP: 'SDP',
  SF: 'SFG', SFG: 'SFG',
  TB: 'TBR', TBR: 'TBR',
  WSH: 'WSN', WSN: 'WSN', WAS: 'WSN',
  OAK: 'ATH', ATH: 'ATH', SAC: 'ATH',
};
function canon(a: string | null | undefined): string {
  if (!a) return '';
  const u = String(a).trim().toUpperCase();
  return ABBR_ALIAS[u] || u;
}

type TeamSide = { abbr: string; name: string; score: number | null; record: string | null };
type Rostered = {
  name: string;
  pos: string;
  mlbTeam: string;
  squad: string;
  draftPosition: number | null;
  side: 'away' | 'home';
};
type TickerGame = {
  gamePk: number;
  state: 'live' | 'pre' | 'final';
  detailed: string;
  startsAt: string | null;
  away: TeamSide;
  home: TeamSide;
  inning: number | null;
  inningState: string | null;
  inningOrdinal: string | null;
  outs: number | null;
  rostered: Rostered[];
};

function mapState(abstract: string | undefined): 'live' | 'pre' | 'final' {
  if (abstract === 'Live') return 'live';
  if (abstract === 'Final') return 'final';
  return 'pre';
}

function side(node: any, lineNode: any): TeamSide {
  const team = node?.team ?? {};
  const wins = node?.leagueRecord?.wins;
  const losses = node?.leagueRecord?.losses;
  const score =
    lineNode?.runs != null ? Number(lineNode.runs)
    : node?.score != null ? Number(node.score)
    : null;
  return {
    abbr: team.abbreviation || team.teamName || team.name || '—',
    name: team.name || team.teamName || '—',
    score,
    record: wins != null && losses != null ? `${wins}-${losses}` : null,
  };
}

// pool players grouped by canonical MLB team abbreviation
async function getPoolByTeam(): Promise<Map<string, Omit<Rostered, 'side'>[]>> {
  const byTeam = new Map<string, Omit<Rostered, 'side'>[]>();
  try {
    const { data } = await supabase
      .from('players')
      .select('name, position, mlb_team, team_id, teams(name, draft_position)')
      .not('team_id', 'is', null);
    for (const p of (data as any[]) ?? []) {
      const key = canon(p.mlb_team);
      if (!key) continue;
      const entry = {
        name: p.name,
        pos: p.position,
        mlbTeam: p.mlb_team,
        squad: p.teams?.name ?? '—',
        draftPosition: p.teams?.draft_position ?? null,
      };
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key)!.push(entry);
    }
  } catch {
    /* pool join is best-effort; ticker still renders without it */
  }
  return byTeam;
}

export async function GET() {
  const date = etDate();
  const url = `${BASE}/api/v1/schedule?sportId=1&date=${date}&hydrate=team,linescore`;

  try {
    const [res, poolByTeam] = await Promise.all([
      fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } }),
      getPoolByTeam(),
    ]);
    if (!res.ok) throw new Error(`schedule ${res.status}`);
    const data = await res.json();

    const rawGames: any[] = data?.dates?.[0]?.games ?? [];
    const games: TickerGame[] = rawGames.map((g) => {
      const line = g.linescore ?? {};
      const away = side(g.teams?.away, line.teams?.away);
      const home = side(g.teams?.home, line.teams?.home);
      const rostered: Rostered[] = [
        ...(poolByTeam.get(canon(away.abbr)) ?? []).map((p) => ({ ...p, side: 'away' as const })),
        ...(poolByTeam.get(canon(home.abbr)) ?? []).map((p) => ({ ...p, side: 'home' as const })),
      ];
      return {
        gamePk: g.gamePk,
        state: mapState(g.status?.abstractGameState),
        detailed: g.status?.detailedState ?? '',
        startsAt: g.gameDate ?? null,
        away,
        home,
        inning: line.currentInning ?? null,
        inningState: line.inningState ?? null,
        inningOrdinal: line.currentInningOrdinal ?? null,
        outs: line.outs ?? null,
        rostered,
      };
    });

    // Order: live first, then upcoming (by start time), then finals.
    const rank = { live: 0, pre: 1, final: 2 } as const;
    games.sort((a, b) => {
      if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
      if (a.state === 'pre' && a.startsAt && b.startsAt) return a.startsAt.localeCompare(b.startsAt);
      return 0;
    });

    return NextResponse.json({ date, games });
  } catch (err) {
    return NextResponse.json(
      { date, games: [], error: (err as Error).message },
      { status: 200 }, // never break the Home page over a ticker hiccup
    );
  }
}
