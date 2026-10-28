// UDP transport over WiFi (ESP32, ESP8266) and in Node: each round's message is broadcast on
// the LAN, through a router or one board acting as access point. Without positions, everyone
// heard in the last `ttl` seconds is a neighbour. With position() (robots that know where they
// are), neighbours are those within `range`, and nbrSense('range') is their distance.
var A = require('nbrjs');
var MAGIC = 'N';

// Usually reached through require('nbrjs').start(program, {target: 'udp', ...}), once WiFi is up.
// opts: {period ms (1000), ttl s (3 periods), port (4210), address ('255.255.255.255'),
//        wifi: {ssid, password} to connect first, id (from getSerial()),
//        position: () => [x, y], range: neighbourhood radius (same unit),
//        sensors: (id) => ({...}), onResult: (value, id) => ...,
//        socket: a dgram socket to use instead of a new one}
exports.start = function (program, opts) {
  opts = opts || {};
  var period = opts.period || 1000, ttl = opts.ttl || 3 * period / 1000;
  var port = opts.port || 4210, address = opts.address || '255.255.255.255';
  var id = opts.id || (typeof getSerial === 'function' ? getSerial() : Math.random().toString(36)).replace(/\W/g, '').slice(-6);
  var dev = A.device(id), inbox = {}, seen = {}, dist = {}, here = null;
  var now = function () { return typeof getTime === 'function' ? getTime() : Date.now() / 1000; };

  if (opts.wifi) require('Wifi').connect(opts.wifi.ssid, { password: opts.wifi.password }, function (e) {
    if (e) console.log('nbrjs: WiFi ' + e);
  });

  // Datagram: MAGIC + sender id [+ '@x,y'] + ' ' + JSON message.
  var sock = opts.socket || require('dgram').createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('message', function (msg) {
    var s = String(msg), sp = s.indexOf(' '), head = s.slice(1, sp).split('@'), j = head[0];
    if (s[0] !== MAGIC || sp < 2 || j === id) return;
    if (head[1] && here) {
      var p = head[1].split(','), d = Math.sqrt(Math.pow(p[0] - here[0], 2) + Math.pow(p[1] - here[1], 2));
      if (opts.range && d > opts.range) { delete inbox[j]; delete seen[j]; delete dist[j]; return; }
      dist[j] = d;
    }
    try { inbox[j] = A.decode(s.slice(sp + 1)); } catch (e) { return; }
    seen[j] = now();
  });
  sock.bind(port, function () { if (sock.setBroadcast) sock.setBroadcast(true); }); // Espruino: always on

  var round = function () {
    var t = now();
    for (var j in seen) if (t - seen[j] > ttl) { delete inbox[j]; delete seen[j]; delete dist[j]; }
    here = opts.position ? opts.position() : null;
    var r = dev.round(program, inbox, opts.sensors ? opts.sensors(id) : {}, { range: dist });
    var at = here ? '@' + Math.round(here[0] * 100) / 100 + ',' + Math.round(here[1] * 100) / 100 : '';
    var data = MAGIC + id + at + ' ' + A.encode(r.message);
    try { sock.send(data, port, address); } catch (e) { console.log('nbrjs: ' + e.message); }
    if (opts.onResult) opts.onResult(r.value, id);
    return r;
  };
  var timer = setInterval(round, period);
  return { id: id, round: round, stop: function () { clearInterval(timer); sock.close(); } };
};

A.targets.udp = exports;
