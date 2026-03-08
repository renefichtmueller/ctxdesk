// CtxDesk PM2 Config — Mac Studio (.169) Port 3002
// Start:   pm2 start ecosystem.config.js
// Restart: pm2 restart ctxdesk
// Logs:    pm2 logs ctxdesk
// Save:    pm2 save && pm2 startup

module.exports = {
  apps: [
    {
      name: "ctxdesk",
      script: ".next/standalone/server.js",
      cwd: "/Users/user/Desktop/Claude Code/ctxdesk",
      interpreter: "/opt/homebrew/bin/node",
      env: {
        PORT: 3002,
        HOSTNAME: "0.0.0.0",          // LAN-Zugang von MacBook .199 + jedem Gerät
        NODE_ENV: "production",
        DATABASE_URL: "file:/Users/user/Desktop/Claude Code/ctxdesk/dev.db",
      },
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      log_file: "/Users/user/Desktop/Claude Code/ctxdesk/logs/combined.log",
      error_file: "/Users/user/Desktop/Claude Code/ctxdesk/logs/error.log",
      out_file: "/Users/user/Desktop/Claude Code/ctxdesk/logs/out.log",
    },
  ],
};
