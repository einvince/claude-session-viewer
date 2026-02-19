module.exports = {
  apps: [
    {
      name: 'claude-viewer',
      script: './server.js',
      cwd: '/root/claude-session-viewer',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/root/.pm2/logs/claude-viewer-error.log',
      out_file: '/root/.pm2/logs/claude-viewer-out.log'
    }
  ]
}
