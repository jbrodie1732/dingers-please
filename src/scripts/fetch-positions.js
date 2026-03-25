// fetch-positions.js
// Fetches the Baseball Reference fielding appearances page for the current season
// and outputs data/positions.csv — which the draft tool reads to determine position eligibility.
//
// Usage:
//   node src/scripts/fetch-positions.js            # fetches live from Baseball Reference
//   node src/scripts/fetch-positions.js --year 2025

require('dotenv').config();
const axios   = require('axios');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');

const YEAR = process.argv.includes('--year')
  ? process.argv[process.argv.indexOf('--year') + 1]
  : new Date().getFullYear();

const URL = `https://www.baseball-reference.com/leagues/majors/${YEAR}-appearances-fielding.shtml`;
const OUT  = path.join(__dirname, '../../data/positions.csv');

const VALID_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

async function run() {
  console.log(`Fetching position data from Baseball Reference (${YEAR})...`);
  console.log(`URL: ${URL}\n`);

  let html;
  try {
    const { data } = await axios.get(URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    html = data;
  } catch (err) {
    console.error('❌ Failed to fetch Baseball Reference page:', err.message);
    console.error('\nAlternative: Download the page manually and save it, then run:');
    console.error('  node src/scripts/fetch-positions.js --file /path/to/downloaded.html');
    process.exit(1);
  }

  const results = parseAppearancesPage(html);
  if (results.length === 0) {
    console.error('❌ No player data found. The page format may have changed.');
    process.exit(1);
  }

  const csv = ['name,primary_position,mlb_team']
    .concat(results.map(r => `"${r.name}","${r.position}","${r.team}"`))
    .join('\n');

  fs.writeFileSync(OUT, csv, 'utf8');
  console.log(`✅ Wrote ${results.length} players to ${OUT}`);
  console.log('\nTop 10 by position:');
  const byPos = {};
  results.forEach(r => { (byPos[r.position] = byPos[r.position] || []).push(r.name); });
  Object.entries(byPos).sort().forEach(([pos, names]) => {
    console.log(`  ${pos}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` (+${names.length - 3} more)` : ''}`);
  });
}

function parseAppearancesPage(html) {
  const $     = cheerio.load(html);
  const rows  = [];

  // Baseball Reference wraps commented-out tables in <!-- --> for some tables.
  // We need to unwrap them first.
  const commentedHtml = [];
  $('*').contents().filter(function() {
    return this.type === 'comment';
  }).each(function() {
    commentedHtml.push(this.data);
  });

  // Try the main table first, then commented content
  let tableHtml = $('table#appearances_fielding').html()
    ? $.html('table#appearances_fielding')
    : '';

  if (!tableHtml) {
    // Try finding it in commented HTML (BR sometimes does this)
    for (const block of commentedHtml) {
      if (block.includes('appearances_fielding')) {
        tableHtml = block;
        break;
      }
    }
  }

  if (!tableHtml) {
    console.warn('⚠️  Could not find appearances_fielding table. Trying all tables...');
    tableHtml = $.html();
  }

  const $2 = cheerio.load(tableHtml);

  $2('table tbody tr').each((_i, row) => {
    const $row = $2(row);

    // Skip header/spacer rows
    if ($row.hasClass('thead') || $row.hasClass('spacer') || $row.hasClass('partial_table')) return;

    const nameEl = $row.find('td[data-stat="player"]');
    const name   = nameEl.text().trim();
    if (!name || name === 'Player') return;

    // Strip any trailing position notation (e.g. "Mike Trout\\n\\n")
    const cleanName = name.replace(/[\n\r\t]/g, '').trim();

    const team = $row.find('td[data-stat="team_ID"]').text().trim();

    // Read game counts for each valid position
    const counts = {};
    for (const pos of VALID_POSITIONS) {
      const stat = pos === '1B' ? 'G_1b'
                 : pos === '2B' ? 'G_2b'
                 : pos === '3B' ? 'G_3b'
                 : pos === 'SS' ? 'G_ss'
                 : pos === 'LF' ? 'G_lf'
                 : pos === 'CF' ? 'G_cf'
                 : pos === 'RF' ? 'G_rf'
                 : pos === 'DH' ? 'G_dh'
                 : pos === 'C'  ? 'G_c'
                 : null;
      if (!stat) continue;
      const val = parseInt($row.find(`td[data-stat="${stat}"]`).text().trim() || '0', 10);
      counts[pos] = isNaN(val) ? 0 : val;
    }

    const totalGames = Object.values(counts).reduce((s, v) => s + v, 0);
    if (totalGames === 0) return;

    // Primary position = whichever position has the most games
    const primary = Object.entries(counts).reduce((max, cur) => cur[1] > max[1] ? cur : max, ['', 0]);
    if (primary[1] === 0) return;

    rows.push({ name: cleanName, position: primary[0], team });
  });

  return rows;
}

run().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
