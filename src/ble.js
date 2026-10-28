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

// Binary messages, since adverts are tiny. Per entry: 2-byte path hash, a tag, the value.
// Tag: 0-63 a small integer itself | 64 + index in SPECIAL | +128: per-neighbour overrides
// follow (count, then 2-byte id + tagged value each). A hop gradient takes 3 bytes.
var SPECIAL = [null, false, true, Infinity, -Infinity, NaN, 'mark', 'int', 'f32', 'json'];
var chr = String.fromCharCode;
var two = function (n) { return chr(n >> 8 & 255, n & 255); };
var val = function (v, flag) {
  if (v === undefined) v = null;
  if (typeof v === 'number' && v === (v | 0)) {
    if (v >= 0 && v < 64) return chr(v | flag);
    var z = ((v << 1) ^ (v >> 31)) >>> 0, s = chr(71 | flag); // zigzag varint
    while (z > 127) { s += chr(z & 127 | 128); z = z >>> 7; }
    return s + chr(z);
  }
  var i = v !== v ? 5 : SPECIAL.indexOf(v);
  if (i >= 0) return chr(64 + i | flag);
  if (typeof v === 'number') {
    var f = new Float32Array([v]), b = new Uint8Array(f.buffer); // ponytail: float32, ~7 digits
    return chr(72 | flag, b[0], b[1], b[2], b[3]);
  }
  var j = A.encode(v);
  return chr(73 | flag, j.length) + j;
};
exports.pack = function (msg) {
  var out = '';
  for (var k in msg) {
    var m = msg[k];
    out += two(+k);
    if (m === 1) { out += chr(70); continue; } // scope marker
    var ov = m[1], ids = ov ? Object.keys(ov) : [];
    out += val(m[0], ids.length ? 128 : 0);
    if (ids.length) out += chr(ids.length);
    for (var i = 0; i < ids.length; i++) out += two(parseInt(ids[i], 16)) + val(ov[ids[i]], 0);
  }
  return out;
};
exports.unpack = function (s) {
  var i = 0, msg = {};
  var byte = function () { return s.charCodeAt(i++); };
  var get = function (t) {
    t &= 127;
    if (t < 64) return t;
    if (t === 71) {
      var z = 0, b, sh = 0;
      do { b = byte(); z += (b & 127) * Math.pow(2, sh); sh += 7; } while (b & 128);
      return z % 2 ? -(z + 1) / 2 : z / 2;
    }
    if (t === 72) return new Float32Array(new Uint8Array([byte(), byte(), byte(), byte()]).buffer)[0];
    if (t === 73) { var n = byte(); i += n; return A.decode(s.substr(i - n, n)); }
    return SPECIAL[t - 64];
  };
  while (i < s.length) {
    var k = String(byte() << 8 | byte()), t = byte();
    if (t === 70) { msg[k] = 1; continue; }
    var e = [get(t)];
    if (t & 128) {
      var ov = {};
      for (var n = byte(); n > 0; n--) {
        var id = ('000' + (byte() << 8 | byte()).toString(16)).slice(-4);
        ov[id] = get(byte());
      }
      e.push(ov);
    }
    msg[k] = e;
  }
  return msg;
};

// Usually reached through require('nbrjs').start(program, {target: 'ble', ...}).
// opts: {period ms (1000), ttl s (3 periods), sensors: (id) => ({...}), onResult: (value, id) => ...}
exports.start = function (program, opts) {
  opts = opts || {};
  var period = opts.period || 1000, ttl = opts.ttl || 3 * period / 1000;
  var id = shortId(NRF.getAddress()), dev = A.device(id, true);
  var inbox = {}, rssi = {}, seen = {};

  NRF.setScan(function (d) {
    if (d.manufacturer !== COMPANY) return; // filters may be ignored (ESP32)
    var s = String.fromCharCode.apply(null, new Uint8Array(d.manufacturerData));
    if (s[0] !== MAGIC) return;
    var j = shortId(d.id);
    try { inbox[j] = exports.unpack(s.slice(1)); } catch (e) { return; }
    rssi[j] = d.rssi;
    seen[j] = getTime();
  }, { filters: [{ manufacturerData: { 0x0590: {} } }] });

  var round = function () {
    var now = getTime();
    for (var j in seen) if (now - seen[j] > ttl) { delete inbox[j]; delete rssi[j]; delete seen[j]; }
    var r = dev.round(program, inbox, opts.sensors ? opts.sensors(id) : {}, { rssi: rssi });
    var data = exports.pack(r.message);
    // Too big: send an empty message rather than a stale one; neighbours then skip us.
    if (data.length > MAX) console.log('nbrjs: message is ' + data.length + ' bytes, BLE fits ' + MAX);
    NRF.setAdvertising({}, { showName: false, manufacturer: COMPANY, manufacturerData: MAGIC + (data.length > MAX ? '' : data), interval: 100 });
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
