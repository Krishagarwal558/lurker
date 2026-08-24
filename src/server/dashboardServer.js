const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const repositories = require('../database/repositories');
const { currentMoodPersonality } = require('../ai/personalities');
const logger = require('../utils/logger');

let serverInstance = null;
const startTime = Date.now();

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function serveStatic(req, res, pathname) {
  const publicDir = path.resolve(__dirname, '../../public');
  let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(publicDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[ext] || 'text/plain';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

function startDashboardServer(client) {
  if (serverInstance) return serverInstance;

  const port = config.server.port;
  serverInstance = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const { pathname, searchParams } = parsedUrl;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      return res.end();
    }

    // Health check endpoint (for Railway, Render, Fly.io, Back4App, Docker)
    if (pathname === '/health') {
      return sendJson(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: formatUptime(Date.now() - startTime),
        guilds: client.guilds?.cache?.size || 0,
        ping: client.ws?.ping || 0
      });
    }

    // REST API endpoints
    if (pathname === '/api/status') {
      const memoryUsage = process.memoryUsage();
      const currentMood = currentMoodPersonality();
      return sendJson(res, 200, {
        name: 'Lurker',
        version: '2.0.0',
        online: Boolean(client.user),
        tag: client.user?.tag || 'Not Connected',
        guildsCount: client.guilds?.cache?.size || 0,
        usersTracked: client.users?.cache?.size || 0,
        uptime: formatUptime(Date.now() - startTime),
        uptimeMs: Date.now() - startTime,
        memoryMb: Math.round(memoryUsage.rss / 1024 / 1024),
        ping: client.ws?.ping || 0,
        currentMood: currentMood.label,
        providers: config.ai.providerOrder,
        aiEnabled: config.bot.defaultAiEnabled
      });
    }

    if (pathname === '/api/guilds') {
      const guilds = Array.from(client.guilds?.cache?.values() || []).map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
        icon: g.iconURL()
      }));
      return sendJson(res, 200, { guilds });
    }

    if (pathname === '/api/memories') {
      const guildId = searchParams.get('guildId') || client.guilds?.cache?.first()?.id;
      if (!guildId) return sendJson(res, 200, { memories: [] });
      const memories = repositories.getAllMemories(guildId, 100);
      return sendJson(res, 200, { memories });
    }

    if (pathname.startsWith('/api/memories/') && req.method === 'DELETE') {
      const id = Number(pathname.replace('/api/memories/', ''));
      const guildId = searchParams.get('guildId') || client.guilds?.cache?.first()?.id;
      if (!guildId || !id) return sendJson(res, 400, { error: 'Invalid parameters' });
      const result = repositories.deleteMemoryById({
        guildId,
        memoryId: id,
        requesterId: 'dashboard-admin',
        canModerate: true
      });
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/lore') {
      const guildId = searchParams.get('guildId') || client.guilds?.cache?.first()?.id;
      if (!guildId) return sendJson(res, 200, { lore: [] });

      if (req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.title || !body.content) return sendJson(res, 400, { error: 'Missing title or content' });
        const created = repositories.addGuildLore({
          guildId,
          category: body.category || 'meme',
          title: body.title,
          content: body.content,
          createdBy: 'dashboard'
        });
        return sendJson(res, 201, created);
      }

      const lore = repositories.getGuildLore(guildId, 50);
      return sendJson(res, 200, { lore });
    }

    if (pathname === '/api/stats') {
      const guildId = searchParams.get('guildId') || client.guilds?.cache?.first()?.id;
      if (!guildId) return sendJson(res, 200, { stats: {} });
      const guildStats = repositories.getGuildStats(guildId);
      const settings = repositories.getGuildSettings(guildId);
      return sendJson(res, 200, { stats: guildStats, settings });
    }

    // Serve Static UI
    serveStatic(req, res, pathname);
  });

  serverInstance.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port === 8080 ? 8090 : port + 1;
      logger.warn(`Port ${port} in use. Switching Cyberpunk Dashboard to port ${nextPort}...`);
      serverInstance.listen(nextPort, () => {
        logger.success(`Cyberpunk Dashboard & Health Server running at http://localhost:${nextPort}`);
      });
    } else {
      logger.error('Dashboard server error:', err.message);
    }
  });

  serverInstance.listen(port, () => {
    logger.success(`Cyberpunk Dashboard & Health Server running at http://localhost:${port}`);
  });

  return serverInstance;
}

module.exports = {
  startDashboardServer
};
