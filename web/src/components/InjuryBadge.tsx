// Small emoji + hover tooltip shown next to a player's name when they're on
// MLB's injured list. Sourced from the "injuries" tab of
// data/dingers_player_data.xlsx via src/scripts/load-injuries.js, which
// writes to players.il_status / injury_detail / injury_update. Only ever
// rendered on the Player Pool and Draft Room pages — deliberately left off
// everywhere else (standings, timeline, spray, roster, h2h).

const IL_EMOJI: Record<string, string> = {
  '7-Day IL':  '🩹',
  '10-Day IL': '🤕',
  '60-Day IL': '🚑',
};

export type InjuryInfo = {
  il_status:     string | null;
  injury_detail: string | null;
  injury_update: string | null;
};

export default function InjuryBadge({ il_status, injury_detail, injury_update }: InjuryInfo) {
  if (!il_status) return null;
  const emoji = IL_EMOJI[il_status] ?? '🩹';

  return (
    <span className="injury-badge" tabIndex={0}>
      <span className="injury-emoji" aria-label={il_status}>{emoji}</span>
      <span className="injury-tip" role="tooltip">
        <span className="injury-tip-tier">{il_status}</span>
        {injury_detail && <span className="injury-tip-detail">{injury_detail}</span>}
        {injury_update && <span className="injury-tip-update">{injury_update}</span>}
      </span>
    </span>
  );
}
