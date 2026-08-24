const { startDashboardServer } = require('../server/dashboardServer');

function startHealthServer(client) {
  return startDashboardServer(client);
}

module.exports = {
  startHealthServer
};
