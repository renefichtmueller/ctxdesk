// CtxDesk PM2 Config — Port 3002
// Start:   pm2 start ecosystem.config.js
// Restart: pm2 restart ctxdesk
// Logs:    pm2 logs ctxdesk
// Save:    pm2 save && pm2 startup

const os = require("os");
const path = require("path");

// Auto-detect install directory (where this config file lives)
const CTXDESK_DIR = __dirname;

module.exports = {
  apps: [
    {
      name: "ctxdesk",
      script: ".next/standalone/server.js",
      cwd: CTXDESK_DIR,
      interpreter: "/opt/homebrew/bin/node",
      env: {
        PORT: 3002,
        HOSTNAME: "0.0.0.0",
        NODE_ENV: "production",
        DATABASE_URL: `file:${path.join(CTXDESK_DIR, "dev.db")}`,
        APP_ROOT: CTXDESK_DIR,
      },
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      log_file: path.join(CTXDESK_DIR, "logs/combined.log"),
      error_file: path.join(CTXDESK_DIR, "logs/error.log"),
      out_file: path.join(CTXDESK_DIR, "logs/out.log"),
    },
  ],
};
