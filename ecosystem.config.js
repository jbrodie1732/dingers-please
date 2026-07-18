module.exports = {
  apps: [
    {
      // Live game watcher — polls MLB API every 60s, auto-shuts down when no games
      // PM2 restarts it daily at 11am ET so it's ready for first pitch
      name: 'dinger-watcher',
      script: 'src/watcher/index.js',
      cron_restart: '0 11 * * *',   // restart at 11am ET every day
      time_zone: 'America/New_York', // pin the cron to ET regardless of the host machine's local clock
      watch: false,
      autorestart: true,            // restart if it crashes mid-game (non-zero exit)
      stop_exit_codes: [0],         // but NOT on the intentional "no games for a while" exit(0) —
                                    // otherwise PM2 relaunches it all day and it restart-loops.
                                    // The 11am cron_restart is what brings it back each morning.
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/watcher-error.log',
      out_file: 'logs/watcher-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      // Morning recap — runs once at 8am, sends iMessage summary, then exits
      name: 'dinger-summary',
      script: 'src/scripts/send-summary.js',
      cron_restart: '0 8 * * *',
      time_zone: 'America/New_York', // pin the cron to ET regardless of the host machine's local clock
      watch: false,
      autorestart: false,           // run once and exit
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/summary-error.log',
      out_file: 'logs/summary-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
