// Tiny synchronous simulator (Node and browser, not for devices): devices at 2D positions,
// neighbours within range. Messages go through encode/decode to mimic a real wire.
(function (exports, A) {
  // Node positions {id: [x, y]}: 'line', 'grid', or a jittered grid ('random', seeded).
  exports.layout = function (kind, n, seed) {
    var pos = {}, side = Math.ceil(Math.sqrt(n));
    seed = seed || 42;
    var rnd = function () { seed = seed * 16807 % 2147483647; return seed / 2147483647 - 0.5; };
    for (var i = 0; i < n; i++) {
      var x = i % side, y = Math.floor(i / side);
      pos[i] = kind === 'line' ? [i, 0] : kind === 'grid' ? [x, y] : [x + rnd() * 0.8, y + rnd() * 0.8];
    }
    return pos;
  };

  // opts: {codec: {encode, decode, hashed, id(key)} for another wire format (JSON by default;
  //        bleCodec() for BLE), loss: chance a message is not heard, skip: chance a device
  //        misses a round, ttl: rounds a neighbour is kept without being heard (1, or 3 with loss/skip)}.
  // A device keeps the last message heard from each neighbour until ttl expires, as on a radio.
  exports.network = function (pos, range, opts) {
    opts = opts || {};
    var ids = Object.keys(pos), msgs = {}, heard = {}, last = {}, t = 0;
    var wire = opts.codec || { encode: A.encode, decode: A.decode };
    var loss = opts.loss || 0, skip = opts.skip || 0, ttl = opts.ttl || (loss || skip ? 3 : 1);
    var far = function (i, j) {
      var dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
      return Math.sqrt(dx * dx + dy * dy);
    };
    // h[j]: [message, round heard, entries heard in that round]. A codec may split a message into
    // chunks (an array), each heard or lost on its own; entries of chunks not heard this round stay
    // from the round before, as on a board.
    var hear = function (h, j, m) {
      if (typeof m === 'string') { if (Math.random() >= loss) h[j] = [wire.decode(m), t, null]; return; }
      var got = null, k, prev = h[j] && h[j][1] === t - 1 && h[j][2] || {};
      m.forEach(function (c) {
        if (Math.random() < loss) return;
        var e = wire.decode(c);
        got = got || {};
        for (k in e) got[k] = e[k];
      });
      if (!got) return;
      var msg = {};
      for (k in prev) msg[k] = prev[k];
      for (k in got) msg[k] = got[k];
      h[j] = [msg, t, got];
    };
    var net = {
      pos: pos,       // mutable: move devices by editing it
      range: range,   // mutable too
      devices: {},
      messages: msgs, // last encoded message of each device
      // sensors: {id: {name: value}}; returns {id: value}
      step: function (program, sensors) {
        var out = {}, sent = {};
        t++;
        ids.forEach(function (i) {
          var h = heard[i] = heard[i] || {}, inbox = {}, dist = {}, j;
          for (j in msgs) if (j !== i && far(i, j) <= net.range) hear(h, j, msgs[j]);
          // Keyed by the neighbour's own id, which a codec may make differ from its position key.
          for (j in h) {
            if (t - h[j][1] >= ttl) { delete h[j]; continue; }
            var k = String(net.devices[j].id);
            inbox[k] = h[j][0];
            dist[k] = far(i, j);
          }
          if (i in last && Math.random() < skip) { out[i] = last[i]; sent[i] = msgs[i]; return; }
          var r = net.devices[i].round(program, inbox, sensors && sensors[i], { range: dist });
          out[i] = last[i] = r.value;
          sent[i] = wire.encode(r.message);
        });
        net.messages = msgs = sent;
        return out;
      }
    };
    // With hashed keys, net.collisions lists the paths that share one: their operators would mix.
    var paths = {}, seen = {}, key = function (p) {
      var h = A.hash(p, wire.seed, wire.bytes);
      seen[p] = 1;
      if (h in paths && paths[h] !== p && paths[h] !== null) { net.collisions.push([paths[h], p]); paths[h] = null; }
      else if (!(h in paths)) paths[h] = p;
      return h;
    };
    net.collisions = [];
    // The smallest hash seed under which none of the paths seen so far collide.
    net.freeSeed = function () {
      for (var s = 1; s < 1000; s++) {
        var hs = {}, ok = true;
        for (var p in seen) {
          var h = A.hash(p, s, wire.bytes);
          if (hs[h]) { ok = false; break; }
          hs[h] = 1;
        }
        if (ok) return s;
      }
    };
    ids.forEach(function (id) { net.devices[id] = A.device(wire.id ? wire.id(id) : id, wire.hashed && key); });
    return net;
  };

  // The BLE wire format, for network(pos, range, {codec: bleCodec()}): hashed paths, float32 numbers,
  // ids as wide as real ones (node 3 is 40963), and messages over 23 bytes in up to `chunks` adverts
  // (4, as many as a 400 ms listening window hears) that the simulator hears or loses one by one.
  // opts: {chunks, hashSeed, hashBytes}, as in start(..., {target: 'ble'}).
  // Here rather than in nbrjs/ble, which goes on the boards.
  exports.bleCodec = function (opts) {
    opts = opts || {};
    var B = typeof nbrjsBle !== 'undefined' ? nbrjsBle : require('nbrjs/ble');
    return {
      hashed: true,
      seed: opts.hashSeed,
      bytes: opts.hashBytes,
      id: function (key) { return 40960 + +key; },
      encode: function (msg) {
        var data = B.pack(msg, opts.hashBytes);
        return data.length > 23 ? B.split(msg, opts.chunks || 4, opts.hashBytes) : data;
      },
      decode: function (s) { return B.unpack(s, opts.hashBytes); }
    };
  };

  // The 'sim' target: start(program, {target: 'sim', nodes, layout, range, period,
  // sensors: (id, x, y, round) => ({...}), onResult: (value, id) => ...}).
  exports.start = function (program, cfg) {
    var net = exports.network(cfg.pos || exports.layout(cfg.layout, cfg.nodes || 10, cfg.seed), cfg.range || 1.5,
      { loss: cfg.loss, skip: cfg.skip, ttl: cfg.ttl });
    var rounds = 0;
    var round = function () {
      var s = {}, id;
      for (id in net.pos) s[id] = cfg.sensors ? cfg.sensors(id, net.pos[id][0], net.pos[id][1], rounds) : {};
      var out = net.step(program, s);
      rounds++;
      if (cfg.onResult) for (id in out) cfg.onResult(out[id], id);
      return out;
    };
    var timer = setInterval(round, cfg.period || 1000);
    return { net: net, round: round, stop: function () { clearInterval(timer); } };
  };
  A.targets.sim = exports;
})(
  typeof exports === 'undefined' ? (this.nbrjsSim = {}) : exports,
  typeof nbrjs === 'undefined' ? require('nbrjs') : nbrjs
);
