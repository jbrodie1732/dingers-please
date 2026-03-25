const { execFile } = require('child_process');
const path = require('path');

const APPLESCRIPT      = path.join(__dirname, '../../applescripts/sendMessage.applescript');
const SUMMARY_SCRIPT   = path.join(__dirname, '../../applescripts/sendMessage_summary.applescript');
const CHAT_NAME        = process.env.IMESSAGE_GROUP_CHAT || 'Dingers only';

function getDongLabel(count) {
  if (count <= 5)  return '100% Mickey Mouse Bullshit. the whole mf clubhouse';
  if (count <= 12) return '75% pretty mickey mouse ngl';
  if (count <= 19) return '50% Goofy';
  if (count <= 27) return '25% donald duck';
  return 'okay kinda legit';
}

function buildAlertMessage({ playerName, playerTotal, distance, fantasyTeam, teamTotal, rank }) {
  const distStr = distance != null ? `${distance} ft.` : 'N/A';
  return [
    '🚨 DINGER ALERT 🚨',
    `Player: ${playerName} (${playerTotal})`,
    `Distance: ${distStr}`,
    `Team: ${fantasyTeam}`,
    `Team HR Total: ${teamTotal}`,
    `Current Rank: ${rank}`,
  ].join('\n');
}

function sendAlert(alertData) {
  const message = buildAlertMessage(alertData);
  execFile('osascript', [APPLESCRIPT, message], (error, _stdout, stderr) => {
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
