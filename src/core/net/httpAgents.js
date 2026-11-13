const https = require('https');
const http = require('http');

// Agentes HTTP optimizados para reutilización de conexiones
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 150,
    maxFreeSockets: 10,
    timeout: 60000,
    scheduling: 'lifo'
});

const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 150,
    maxFreeSockets: 10,
    timeout: 60000,
    scheduling: 'lifo'
});

module.exports = {
    httpsAgent,
    httpAgent
};