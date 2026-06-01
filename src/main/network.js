const dgram = require('dgram');
const net = require('net');
const os = require('os');

const BROADCAST_PORT = 51234;
const MESSAGE_PORT = 51235;
let peers = new Map(); // hostname -> { host, port, user }
let server = null;
let broadcastSocket = null;
let onPeerFound = null;
let onMessageReceived = null;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function startServer(userInfo, onPeer, onMessage) {
  onPeerFound = onPeer;
  onMessageReceived = onMessage;
  const localIP = getLocalIP();

  // UDP broadcast listener
  broadcastSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  broadcastSocket.on('listening', () => broadcastSocket.setBroadcast(true));
  broadcastSocket.on('message', (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'discovery' && data.user && data.host !== localIP) {
        peers.set(data.user.id, { host: data.host, port: MESSAGE_PORT, user: data.user });
        if (onPeerFound) onPeerFound(data.user);
        // Respond to confirm
        const reply = JSON.stringify({ type: 'discovery_reply', user: userInfo, host: localIP });
        broadcastSocket.send(reply, rinfo.port, rinfo.address);
      }
      if (data.type === 'discovery_reply' && data.user && data.host !== localIP) {
        peers.set(data.user.id, { host: data.host, port: MESSAGE_PORT, user: data.user });
        if (onPeerFound) onPeerFound(data.user);
      }
    } catch {}
  });
  broadcastSocket.bind(BROADCAST_PORT);

  // UDP broadcast sender - send every 10s
  setInterval(() => {
    const msg = JSON.stringify({ type: 'discovery', user: userInfo, host: localIP });
    broadcastSocket.send(msg, BROADCAST_PORT, '255.255.255.255');
  }, 10000);

  // TCP server for messages
  server = net.createServer((socket) => {
    let buffer = '';
    socket.on('data', (data) => {
      buffer += data.toString();
      try {
        const msg = JSON.parse(buffer);
        buffer = '';
        if (onMessageReceived) onMessageReceived(msg);
        socket.write(JSON.stringify({ status: 'ok' }));
      } catch { /* wait for more data */ }
    });
  });
  server.listen(MESSAGE_PORT);

  return { localIP, port: MESSAGE_PORT };
}

function sendToPeer(host, data) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(MESSAGE_PORT, host, () => {
      client.write(JSON.stringify(data));
    });
    client.on('data', (d) => {
      try {
        const resp = JSON.parse(d.toString());
        resolve(resp);
      } catch { resolve({}); }
      client.destroy();
    });
    client.on('error', (e) => { reject(e); client.destroy(); });
    client.on('timeout', () => { reject(new Error('timeout')); client.destroy(); });
    client.setTimeout(5000);
  });
}

function getPeers() { return Array.from(peers.values()); }

function stop() {
  if (broadcastSocket) { try { broadcastSocket.close(); } catch {} }
  if (server) { try { server.close(); } catch {} }
  peers.clear();
}

module.exports = { startServer, sendToPeer, getPeers, stop, getLocalIP };
