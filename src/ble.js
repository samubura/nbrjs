// BLE transport for Espruino boards (Puck.js and other nRF52, ESP32).
// Connectionless: each round's message goes in the advertising packet, and the
// neighbours are whoever we heard in the last `ttl` seconds.
var A = require('nbrjs');
var COMPANY = 0x0590; // Espruino's BLE company id, meant for this kind of use
var MAGIC = 'N';
var MAX = 23; // 31-byte advert - flags (3) - manufacturer header (4) - MAGIC (1)

// Short device id from the BLE address: "aa:bb:cc:dd:ee:ff random" -> "eeff".
// ponytail: 16 bits, collisions unlikely in small swarms; use more bytes if they grow.
var shortId = function (addr) { return addr.substr(12, 5).replace(':', ''); };

// Usually reached through require('nbrjs').start(program, {target: 'ble', ...}).
// opts: {period ms (1000), ttl s (3 periods), sensors: (id) => ({...}), onResult: (value, id) => ...}
exports.start = function (program, opts) {
  opts = opts || {};
  var period = opts.period || 1000, ttl = opts.ttl || 3 * period / 1000;
  var id = shortId(NRF.getAddress()), dev = A.device(id);
  var inbox = {}, rssi = {}, seen = {};

  NRF.setScan(function (d) {
    if (d.manufacturer !== COMPANY) return; // filters may be ignored (ESP32)
    var s = String.fromCharCode.apply(null, new Uint8Array(d.manufacturerData));
    if (s[0] !== MAGIC) return;
    var j = shortId(d.id);
    try { inbox[j] = A.decode(s.slice(1)); } catch (e) { return; }
    rssi[j] = d.rssi;
    seen[j] = getTime();
  }, { filters: [{ manufacturerData: { 0x0590: {} } }] });

  var round = function () {
    var now = getTime();
    for (var j in seen) if (now - seen[j] > ttl) { delete inbox[j]; delete rssi[j]; delete seen[j]; }
    var r = dev.round(program, inbox, opts.sensors ? opts.sensors(id) : {}, { rssi: rssi });
    var data = A.encode(r.message);
    if (data.length > MAX) console.log('nbrjs: message is ' + data.length + ' bytes, BLE fits ' + MAX + ': ' + data);
    else NRF.setAdvertising({}, { showName: false, manufacturer: COMPANY, manufacturerData: MAGIC + data, interval: 100 });
    if (opts.onResult) opts.onResult(r.value, id);
    return r;
  };
  var timer = setInterval(round, period);
  return {
    id: id,
    round: round,
    stop: function () { clearInterval(timer); NRF.setScan(); NRF.setAdvertising({}); }
  };
};

A.targets.ble = exports;
