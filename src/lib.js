// Building blocks on top of the core: require('nbrjs/lib'), opt-in to keep the core small.
// Each one is aggregate()-wrapped, so different blocks never mix their messages.
(function (exports, A) {
  var share = A.share, nbr = A.nbr, rep = A.rep, xc = A.xc;
  var add = function (a, b) { return a + b; };
  var metricOr = function (m) { return m === undefined ? A.nbrSense('range') : m; };

  // Id of the neighbour with the smallest value, or null if none is below `below` (Infinity).
  var minId = exports.minId = function (field, below) {
    return field.map(function (v, id) { return [v, id]; })
      .reduce(function (best, p) { return p[0] < best[0] ? p : best; }, [below === undefined ? Infinity : below, null])[1];
  };

  // Hops to the nearest source; Infinity where no source is reachable.
  exports.hopsTo = A.aggregate('hopsTo', function (source) {
    return share(Infinity, function (d) { return source ? 0 : d.min() + 1; });
  });
  // Distance to the nearest source along the network. metric: the length of each link,
  // a field (default nbrSense('range'), estimated from the signal on BLE) or a number.
  exports.distanceTo = A.aggregate('distanceTo', function (source, metric) {
    var m = metricOr(metric);
    return share(Infinity, function (d) { return source ? 0 : d.zip(m, add).min(); });
  });
  // The value of the nearest source, everywhere; undefined where no source is reachable.
  exports.broadcast = A.aggregate('broadcast', function (source, value, metric) {
    var m = metricOr(metric);
    return share([Infinity, undefined], function (n) {
      if (source) return [0, value];
      return n.zip(m, function (p, r) { return [p[0] + r, p[1]]; })
        .reduce(function (best, p) { return p[0] < best[0] ? p : best; }, [Infinity, undefined]);
    })[1];
  });
  // Sums value toward the source along `distance` (e.g. hopsTo(source)): each device sends its
  // partial sum to the neighbour closest to the source only. The source gets the total.
  exports.collectSum = A.aggregate('collectSum', function (distance, value) {
    var parent = minId(nbr(distance), distance);
    return xc(0, function (n) {
      var total = n.sum(value);
      return A.retsend(total, n.map(function (x, id) { return id === parent ? total : 0; }));
    });
  });
  // The largest / smallest value in the whole network (it never goes back: a past maximum stays).
  exports.networkMax = A.aggregate('networkMax', function (v) {
    return share(v, function (n) { return Math.max(v, n.max()); });
  });
  exports.networkMin = A.aggregate('networkMin', function (v) {
    return share(v, function (n) { return Math.min(v, n.min()); });
  });
  // Spread-out leaders: true on devices that win a random draw against the best candidate heard
  // within radius. Two leaders are never neighbours; most are about radius apart.
  exports.isLeader = A.aggregate('isLeader', function (radius, metric) {
    var m = metricOr(metric), me = rep(Math.random(), function (x) { return x; });
    return share([me, 0], function (n) {
      return n.zip(m, function (p, r) { return [p[0], p[1] + r]; })
        .reduce(function (best, p) { return p[1] < radius && p[0] < best[0] ? p : best; }, [me, 0]);
    })[0] === me;
  });
  exports.neighbourCount = A.aggregate('neighbourCount', function () { return nbr(1).sum(); });
  exports.rounds = A.aggregate('rounds', function () { return rep(0, function (c) { return c + 1; }); });
  // from, from - 1, ..., 0, then stays at 0.
  exports.countdown = A.aggregate('countdown', function (from) {
    return rep(from, function (c) { return Math.max(c - 1, 0); });
  });

  // require('nbrjs/lib').globals(): the blocks as globals, like the core's.
  exports.globals = function () {
    var g = typeof globalThis !== 'undefined' ? globalThis : global;
    for (var k in exports) if (k !== 'globals') g[k] = exports[k];
    return exports;
  };
})(
  typeof exports === 'undefined' ? (this.nbrjsLib = {}) : exports,
  typeof nbrjs === 'undefined' ? require('nbrjs') : nbrjs
);
