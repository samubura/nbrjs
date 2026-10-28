// UDP transport over WiFi (ESP32, ESP8266) and in Node: each round's message is broadcast
// on the LAN. Everyone heard in the last `ttl` seconds is a neighbour: the LAN is one neighbourhood.
var A = require('nbrjs');
var MAGIC = 'N';

// Usually reached through require('nbrjs').start(program, {target: 'udp', ...}), once WiFi is up.
// opts: {period ms (1000), ttl s (3 periods), port (4210), address ('255.255.255.255'),
//        wifi: {ssid, password} to connect first, id (from getSerial()),
//        sensors: (id) => ({...}), onResult: (value, id) => ...,
//        socket: a dgram socket to use instead of a new one}
exports.start = function (program, opts) {
  opts = opts || {};
  var period = opts.period || 1000, ttl = opts.ttl || 3 * period / 1000;
  var port = opts.port || 4210, address = opts.address || '255.255.255.255';
  var id = opts.id || (typeof getSerial === 'function' ? getSerial() : Math.random().toString(36)).replace(/\W/g, '').slice(-6);
  var dev = A.device(id), inbox = {}, seen = {};
  var now = function () { return typeof getTime === 'function' ? getTime() : Date.now() / 1000; };

  if (opts.wifi) require('Wifi').connect(opts.wifi.ssid, { password: opts.wifi.password }, function (e) {
    if (e) console.log('nbrjs: WiFi ' + e);
  });

  // Datagram: MAGIC + sender id + ' ' + JSON message.
  var sock = opts.socket || require('dgram').createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('message', function (msg) {
    var s = String(msg), sp = s.indexOf(' '), j = s.slice(1, sp);
    if (s[0] !== MAGIC || sp < 2 || j === id) return;
    try { inbox[j] = A.decode(s.slice(sp + 1)); } catch (e) { return; }
    seen[j] = now();
  });
  sock.bind(port, function () { if (sock.setBroadcast) sock.setBroadcast(true); }); // Espruino: always on

  var round = function () {
    var t = now();
    for (var j in seen) if (t - seen[j] > ttl) { delete inbox[j]; delete seen[j]; }
    var r = dev.round(program, inbox, opts.sensors ? opts.sensors(id) : {}, {});
    var data = MAGIC + id + ' ' + A.encode(r.message);
    try { sock.send(data, port, address); } catch (e) { console.log('nbrjs: ' + e.message); }
    if (opts.onResult) opts.onResult(r.value, id);
    return r;
  };
  var timer = setInterval(round, period);
  return { id: id, round: round, stop: function () { clearInterval(timer); sock.close(); } };
};

A.targets.udp = exports;
