// Tiny synchronous simulator (Node and browser, not for devices): devices at 2D positions,
// neighbours within range. Messages go through encode/decode to mimic a real wire: JSON, or
// codec = {encode, decode, hashed, id(key)} such as nbrjsBle.sim for the BLE format.
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

  exports.network = function (pos, range, codec) {
    var ids = Object.keys(pos), msgs = {}, wire = codec || { encode: A.encode, decode: A.decode };
    var net = {
      pos: pos,       // mutable: move devices by editing it
      range: range,   // mutable too
      devices: {},
      messages: msgs, // last encoded message of each device
      // sensors: {id: {name: value}}; returns {id: value}
      step: function (program, sensors) {
        var out = {}, sent = {};
        ids.forEach(function (i) {
          var inbox = {}, dist = {};
          ids.forEach(function (j) {
            var dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
            var d = Math.sqrt(dx * dx + dy * dy);
            if (i === j || d > net.range) return;
            // Keyed by the neighbour's own id, which a codec may make differ from its position key.
            var k = String(net.devices[j].id);
            dist[k] = d;
            if (j in msgs) inbox[k] = wire.decode(msgs[j]);
          });
          var r = net.devices[i].round(program, inbox, sensors && sensors[i], { range: dist });
          out[i] = r.value;
          sent[i] = wire.encode(r.message);
        });
        net.messages = msgs = sent;
        return out;
      }
    };
    ids.forEach(function (id) { net.devices[id] = A.device(wire.id ? wire.id(id) : id, wire.hashed); });
    return net;
  };

  // The 'sim' target: start(program, {target: 'sim', nodes, layout, range, period,
  // sensors: (id, x, y, round) => ({...}), onResult: (value, id) => ...}).
  exports.start = function (program, cfg) {
    var net = exports.network(cfg.pos || exports.layout(cfg.layout, cfg.nodes || 10, cfg.seed), cfg.range || 1.5);
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
