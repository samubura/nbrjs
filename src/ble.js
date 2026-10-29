// BLE transport for Espruino boards (Puck.js and other nRF52, ESP32).
// Connectionless: each round's message goes in the advertising packet, and the
// neighbours are whoever we heard in the last `ttl` seconds.
// Loads in the browser too (pack/unpack only), where the playground uses it to show BLE sizes.
(function (exports, A) {
  var COMPANY = 0x0590; // Espruino's BLE company id, meant for this kind of use
  var MAX = 23; // 31-byte advert - flags (3) - manufacturer header (4) - first byte (A.magic)

  // Device id from the BLE address, a number: "aa:bb:cc:dd:ee:ff random" -> 0xeeff = 61183.
  // A number takes 4 bytes in a message, against 6 for the string "eeff".
  // ponytail: 16 bits, collisions unlikely in small swarms; use more bytes if they grow.
  var shortId = function (addr) { return parseInt(addr.substr(12, 5).replace(':', ''), 16); };

  // Binary messages, since adverts are tiny. Per entry: 2-byte path hash, a tag, the value.
  // Tag: 0-63 a small integer itself | 64 + index in SPECIAL | 80 + n: an array of n < 16 tagged values
  // (objects travel as arrays, see xc) | +128: per-neighbour overrides follow (count, then 2-byte
  // id + tagged value each). A hop gradient takes 3 bytes, {dist: 2.83, value: 'a'} 9.
  var SPECIAL = [null, false, true, Infinity, -Infinity, NaN, 'mark', 'int', 'f32', 'json', 'str'];
  var chr = String.fromCharCode;
  var two = function (n) { return chr(n >> 8 & 255, n & 255); };
  // ASCII only, as engines differ on other characters. Not a regex: Espruino 2v29 gets ranges in classes wrong.
  var ascii = function (s) {
    for (var i = 0; i < s.length; i++) if (s.charCodeAt(i) > 127) return false;
    return true;
  };
  var val = function (v, flag) {
    if (v === undefined) v = null;
    if (typeof v === 'number' && v === (v | 0)) {
      if (v >= 0 && v < 64) return chr(v | flag);
      var z = ((v << 1) ^ (v >> 31)) >>> 0, s = chr(71 | flag); // zigzag varint
      while (z > 127) { s += chr(z & 127 | 128); z = z >>> 7; }
      return s + chr(z);
    }
    var i = v !== v ? 5 : typeof v === 'string' ? -1 : SPECIAL.indexOf(v);
    if (i >= 0) return chr(64 + i | flag);
    if (Array.isArray(v) && v.length < 16) return chr(80 + v.length | flag) + v.map(function (x) { return val(x, 0); }).join('');
    if (typeof v === 'string' && v.length < 256 && ascii(v)) return chr(74 | flag, v.length) + v;
    if (typeof v === 'number') {
      var f = new Float32Array([v]), b = new Uint8Array(f.buffer); // ponytail: float32, ~7 digits
      return chr(72 | flag, b[0], b[1], b[2], b[3]);
    }
    var j = A.encode(v);
    return chr(73 | flag, j.length) + j;
  };
  // kb: bytes of each key (the path hash), 2 by default; the same on every device.
  var key = function (k, kb) { return kb === 1 ? chr(k) : kb === 3 ? chr(k >> 16 & 255) + two(k & 65535) : two(k); };
  exports.pack = function (msg, kb) {
    var out = '';
    for (var k in msg) {
      var m = msg[k];
      out += key(+k, kb);
      if (m === 1) { out += chr(70); continue; } // scope marker
      var ov = m[1], ids = ov ? Object.keys(ov) : [];
      out += val(m[0], ids.length ? 128 : 0);
      if (ids.length) out += chr(ids.length);
      for (var i = 0; i < ids.length; i++) out += two(+ids[i]) + val(ov[ids[i]], 0);
    }
    return out;
  };
  exports.unpack = function (s, kb) {
    var i = 0, msg = {};
    var byte = function () { return s.charCodeAt(i++); };
    var get = function (t) {
      t &= 127;
      if (t < 64) return t;
      if (t === 71) {
        var z = 0, b, sh = 0;
        do { b = byte(); z += (b & 127) * (1 << sh); sh += 7; } while (b & 128); // not Math.pow: inexact on Espruino 2v29
        return z % 2 ? -(z + 1) / 2 : z / 2;
      }
      if (t === 72) return new Float32Array(new Uint8Array([byte(), byte(), byte(), byte()]).buffer)[0];
      if (t === 73) { var n = byte(); i += n; return A.decode(s.substr(i - n, n)); }
      if (t === 74) { n = byte(); i += n; return s.substr(i - n, n); }
      if (t >= 80 && t < 96) { var a = []; for (var c = t - 80; c > 0; c--) a.push(get(byte())); return a; }
      return SPECIAL[t - 64];
    };
    while (i < s.length) {
      var k = byte();
      if (kb !== 1) k = k << 8 | byte();
      if (kb === 3) k = k << 8 | byte();
      k = String(k);
      var t = byte();
      if (t === 70) { msg[k] = 1; continue; }
      var e = [get(t)];
      if (t & 128) {
        var ov = {};
        for (var n = byte(); n > 0; n--) {
          var id = String(byte() << 8 | byte());
          ov[id] = get(byte());
        }
        e.push(ov);
      }
      msg[k] = e;
    }
    return msg;
  };

  // A message over MAX bytes is split into chunks of whole entries, at most `max` of them, that the
  // board advertises in turn. A lost chunk only loses its operators: neighbours are then not aligned
  // with them, as with a lost message. Entries that do not fit are left out.
  exports.split = function (msg, max, kb) {
    var out = [], cur = '';
    for (var k in msg) {
      var one = {};
      one[k] = msg[k];
      var e = exports.pack(one, kb);
      if (e.length > MAX - 1) continue; // never fits, even alone (a chunk also carries the round)
      if (cur.length + e.length > MAX - 1) { out.push(cur); cur = ''; }
      cur += e;
    }
    if (cur) out.push(cur);
    return out.slice(0, max);
  };

  // Usually reached through require('nbrjs').start(program, {target: 'ble', ...}).
  // opts: {period ms (1000), ttl s (3 periods), scan: ms of listening per period (400; >= period
  //        listens all the time), minRssi: ignore weaker neighbours (dBm), txPower: RSSI at 1 m (-60),
  //        group: only hear devices with the same group (e.g. the program's name),
  //        hashSeed: another hash for operator names, when two collide (the playground suggests one),
  //        hashBytes: bytes per operator name, 1-3 (2): more make collisions much rarer,
  //        chunks: adverts a message over 23 bytes may take (as many as a listening window hears,
  //        one advert every 100 ms: 4 by default),
  //        sensors: (id) => ({...}), onResult: (value, id) => ...}
  // Neighbour sensors: nbrSense('rssi') in dBm, nbrSense('range') a rough distance in metres.
  exports.start = function (program, opts) {
    opts = opts || {};
    var period = opts.period || 1000, ttl = opts.ttl || 3 * period / 1000, scan = opts.scan || 400;
    var tx = opts.txPower || -60, minRssi = opts.minRssi || -200;
    var chunks = opts.chunks || Math.max(1, Math.floor(Math.min(scan, period) / 100));
    var seed = opts.hashSeed, kb = opts.hashBytes;
    var hashed = seed || kb ? function (p) { return A.hash(p, seed, kb); } : true;
    var id = shortId(NRF.getAddress()), dev = A.device(id, hashed), magic = A.magic(opts.group);
    // Chunked adverts start with the magic byte + 128, then the sender's round number.
    var chunked = String.fromCharCode(magic.charCodeAt(0) | 128), count = 0;
    // parts[j]: [round, entries heard in it, entries of the round before], so a chunk not heard yet
    // keeps its entries from the previous round.
    var inbox = {}, rssi = {}, range = {}, seen = {}, parts = {}, stopScan = null;

    var heard = function (d) {
      if (d.manufacturer !== COMPANY || d.rssi < minRssi) return; // filters may be ignored (ESP32)
      var s = String.fromCharCode.apply(null, new Uint8Array(d.manufacturerData));
      var j = shortId(d.id), msg, k;
      if (s[0] === magic) {
        try { msg = exports.unpack(s.slice(1), kb); } catch (e) { return; }
      } else if (s[0] === chunked) {
        var r = s.charCodeAt(1), p = parts[j], e;
        try { e = exports.unpack(s.slice(2), kb); } catch (x) { return; }
        if (!p || p[0] !== r) p = parts[j] = [r, {}, p && (p[0] + 1 & 255) === r ? p[1] : {}];
        for (k in e) p[1][k] = e[k];
        msg = {};
        for (k in p[2]) msg[k] = p[2][k];
        for (k in p[1]) msg[k] = p[1][k];
      } else return;
      inbox[j] = msg;
      rssi[j] = d.rssi;
      // ponytail: log-distance path loss with exponent 2; calibrate txPower per board and place.
      range[j] = Math.pow(10, (tx - d.rssi) / 20);
      seen[j] = getTime();
    };
    // Listening costs most of the power: a window per period, unless scan >= period.
    var listen = function () {
      NRF.setScan(heard, { filters: [{ manufacturerData: { 0x0590: {} } }] });
      if (scan < period) stopScan = setTimeout(function () { stopScan = null; NRF.setScan(); }, scan);
    };

    // Also callable on events (setWatch) for an immediate round.
    var round = function () {
      var now = getTime();
      for (var j in seen) if (now - seen[j] > ttl) { delete inbox[j]; delete rssi[j]; delete range[j]; delete seen[j]; delete parts[j]; }
      var r = dev.round(program, inbox, opts.sensors ? opts.sensors(id) : {}, { rssi: rssi, range: range });
      var data = exports.pack(r.message, kb), adv = function (m) { return { showName: false, manufacturer: COMPANY, manufacturerData: m, interval: 100 }; };
      if (data.length <= MAX) NRF.setAdvertising({}, adv(magic + data));
      else {
        // Too big for one advert: the board cycles through the chunks (an array of raw adverts).
        var cs = exports.split(r.message, chunks, kb), rn = String.fromCharCode(count++ & 255);
        if (cs.join('').length < data.length) console.log('nbrjs: message is ' + data.length + ' bytes, ' + chunks + ' adverts carry part of it');
        // ponytail: raw adverts in an array, as Espruino's docs describe; check on each board (ESP32 especially).
        if (!cs.length) NRF.setAdvertising({}, adv(magic));
        else NRF.setAdvertising(cs.map(function (c) { return NRF.getAdvertisingData({}, adv(chunked + rn + c)); }), { interval: 100 });
      }
      if (opts.onResult) opts.onResult(r.value, id);
      if (!stopScan && scan < period) listen();
      return r;
    };
    listen();
    var timer = setInterval(round, period);
    return {
      id: id,
      round: round,
      stop: function () {
        clearInterval(timer);
        if (stopScan) clearTimeout(stopScan);
        NRF.setScan();
        NRF.setAdvertising({});
      }
    };
  };

  A.targets.ble = exports;
})(
  typeof exports === 'undefined' ? (this.nbrjsBle = {}) : exports,
  typeof nbrjs === 'undefined' ? require('nbrjs') : nbrjs
);
