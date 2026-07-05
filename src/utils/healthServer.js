const http = require('node:http');

const config = require('../config');
const logger = require('./logger');

function startHealthServer(client) {
  const server = http.createServer((request, response) => {
    if (request.url !== '/' && request.url !== '/health') {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: false, error: 'not_found' }));
      return;
    }

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      ok: true,
      bot: client.user?.tag || null,
      ready: Boolean(client.isReady?.()),
      uptimeSeconds: Math.round(process.uptime())
    }));
  });

  server.listen(config.server.port, '0.0.0.0', () => {
    logger.info(`Health server listening on port ${config.server.port}`);
  });

  server.on('error', (error) => {
    logger.error('Health server failed:', error);
  });

  return server;
}

module.exports = {
  startHealthServer
};
