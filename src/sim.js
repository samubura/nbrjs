// Tiny synchronous simulator: devices at 2D positions, neighbours within range.
// Messages go through encode/decode to mimic a real wire.
(function (exports, A) {
  exports.network = function (pos, range) {
    var ids = Object.keys(pos), devs = {}, msgs = {};
    ids.forEach(function (id) { devs[id] = A.device(id); });
    return {
      pos: pos,
      devices: devs,
      // sensors: {id: {name: value}}; returns {id: value}
      step: function (program, sensors) {
        var out = {}, sent = {};
        ids.forEach(function (i) {
          var inbox = {}, dist = {};
          ids.forEach(function (j) {
            var dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
            var d = Math.sqrt(dx * dx + dy * dy);
            if (i === j || d > range) return;
            dist[j] = d;
            if (msgs[j]) inbox[j] = A.decode(msgs[j]);
          });
          var r = devs[i].round(program, inbox, sensors && sensors[i], { range: dist });
          out[i] = r.value;
          sent[i] = A.encode(r.message);
        });
        msgs = sent;
        return out;
      }
    };
  };
})(
  typeof exports === 'undefined' ? (this.nbrjsSim = {}) : exports,
  typeof nbrjs === 'undefined' ? require('./core.js') : nbrjs
);
