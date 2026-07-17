const { execFile } = require('child_process');
const path = require('path');

const APPLESCRIPT      = path.join(__dirname, '../../applescripts/sendMessage.applescript');
const SUMMARY_SCRIPT   = path.join(__dirname, '../../applescripts/sendMessage_summary.applescript');
const CHAT_NAME        = process.env.IMESSAGE_GROUP_CHAT || 'Dingers only';

// Mickey Meter tiers, keyed off how many of the 30 parks the ball clears.
// Keep these boundaries in sync with web/src/lib/types.ts mickeyTier().
function getDongLabel(count) {
  if (count < 10)  return 'the whole fuckin clubhouse'; // <10
  if (count <= 19) return 'mickey mouse';               // 10–19
  if (count <= 23) return 'kinda mickey mouse';         // 20–23
  return 'okay kinda legit';                            // >=24
}

function buildAlertMessage({ playerName, playerTotal, distance, fantasyTeam, teamTotal, rank, mickeyCount, mickeyLabel }) {
  // Easter egg: the Cole Young draft-night bit. Keep the DINGER ALERT header
  // and the Player line, then drop the running joke in place of the usual
  // stat block. Matches on name (case-insensitive) so it fires for his HRs only.
  if (String(playerName).trim().toLowerCase() === 'cole young') {
    return [
      '🚨 DINGER ALERT 🚨',
      `Player: ${playerName} (${playerTotal})`,
      "did anyone draft him? i'm not sure if this text is going through",
    ].join('\n');
  }

  const distStr = distance != null ? `${distance} ft.` : 'N/A';
  const lines = [
    '🚨 DINGER ALERT 🚨',
    `Player: ${playerName} (${playerTotal})`,
    `Distance: ${distStr}`,
    `Team: ${fantasyTeam}`,
    `Team HR Total: ${teamTotal}`,
    `Current Rank: ${rank}`,
  ];
  if (mickeyCount != null && mickeyLabel) {
    lines.push(`Mickey Meter: ${mickeyCount}/30 — ${mickeyLabel}`);
  }
  return lines.join('\n');
}

function sendAlert(alertData) {
  const message = buildAlertMessage(alertData);
  execFile('osascript', [APPLESCRIPT, message, CHAT_NAME], (error, _stdout, stderr) => {
    if (error) {
      console.error('❌ iMessage alert error:', stderr || error.message);
    } else {
      console.log(`✅ Alert sent — ${alertData.playerName}`);
    }
  });
}

function sendSummary(message) {
  execFile('osascript', [SUMMARY_SCRIPT, CHAT_NAME, message], (error, _stdout, stderr) => {
    if (error) {
      console.error('❌ iMessage summary error:', stderr || error.message);
    } else {
      console.log('✅ Summary sent');
    }
  });
}

module.exports = { sendAlert, sendSummary, getDongLabel, buildAlertMessage };
