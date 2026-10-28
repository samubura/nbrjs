// Minimal aggregate computing core with eXchange Calculus (XC) semantics.
// Espruino-safe subset: no Map/Set, destructuring, spread, default params,
// for...of or function hoisting (helpers are defined before use).
(function (exports) {
  // The round being evaluated. JS is single-threaded, so programs are plain
  // zero-argument functions that read it implicitly.
  var ctx = null;

  // A neighbouring value (XC nvalue): default `d` plus per-device overrides `o`.
  function Field(d, o) {
    this.d = d;
    this.o = o;
    this.self = ctx.key in o ? o[ctx.key] : d;
  }
  Field.prototype.at = function (id) {
    return id in this.o ? this.o[id] : this.d;
  };
  Field.prototype.map = function (fn) {
    var o = {};
    for (var k in this.o) o[k] = fn(this.o[k], k);
    return new Field(fn(this.d), o);
  };
  Field.prototype.zip = function (other, fn) {
    var f = lift(other), o = {}, k;
    for (k in this.o) o[k] = fn(this.o[k], f.at(k));
    for (k in f.o) if (!(k in o)) o[k] = fn(this.d, f.o[k]);
    return new Field(fn(this.d, f.d), o);
  };
  // Folds over the aligned neighbours, self excluded (XC nfold).
  // The reducer gets only (acc, v), so Math.min / Math.max work as-is.
  Field.prototype.reduce = function (fn, acc) {
    var dom = ctx.dom;
    for (var i = 0; i < dom.length; i++) acc = fn(acc, this.at(dom[i]));
    return acc;
  };

  function lift(v) {
    return v instanceof Field ? v : new Field(v, {});
  }

  function RetSend(ret, send) {
    this.ret = ret;
    this.send = send;
  }

  // Next alignment token in the current scope, e.g. "/x0", "/b1.1".
  function next(kind) {
    return ctx.path + '/' + kind + ctx.count++;
  }

  // Evaluates fn in a nested alignment scope: only neighbours that entered the
  // same scope stay aligned. The scope marker is broadcast to tell them so.
  function scoped(p, fn) {
    var c = ctx, path = c.path, count = c.count, dom = c.dom;
    c.msg[p] = 1;
    c.dom = dom.filter(function (j) { return p in c.inbox[j]; });
    c.path = p;
    c.count = 0;
    var r = fn();
    c.path = path;
    c.count = count;
    c.dom = dom;
    return r;
  }

  function xc(init, fn) {
    var c = ctx, p = next('x'), o = {};
    for (var i = 0; i < c.dom.length; i++) {
      var j = c.dom[i], m = c.inbox[j][p];
      if (m) o[j] = m[1] && c.key in m[1] ? m[1][c.key] : m[0];
    }
    o[c.key] = p in c.prev ? c.prev[p] : init;
    var r = fn(new Field(init, o));
    var ret = r instanceof RetSend ? r.ret : r;
    var s = lift(r instanceof RetSend ? r.send : r);
    var ov = null;
    for (var k in s.o) if (k !== c.key) { ov = ov || {}; ov[k] = s.o[k]; }
    c.state[p] = s.self;
    c.msg[p] = ov ? [s.d, ov] : [s.d];
    return ret;
  }

  exports.xc = xc;
  exports.retsend = function (ret, send) { return new RetSend(ret, send); };
  // share(init, f) = xc(init, n => retsend(f(n), f(n))): identical when f returns a value.
  exports.share = xc;
  exports.nbr = function (v) {
    return xc(v, function (n) {
      n.o[ctx.key] = n.self = v;
      return new RetSend(n, v);
    });
  };
  // Kept local instead of derived from xc: rep needs no neighbours, so it sends nothing.
  exports.rep = function (init, fn) {
    var c = ctx, p = next('r');
    return (c.state[p] = fn(p in c.prev ? c.prev[p] : init));
  };
  exports.branch = function (cond, th, el) {
    return scoped(next('b') + (cond ? '.1' : '.0'), cond ? th : el);
  };
  exports.align = function (key, fn) {
    return scoped(ctx.path + '/a:' + key, fn);
  };
  exports.mid = function () { return ctx.id; };
  exports.sense = function (name) { return ctx.sensors[name]; };
  exports.nbrSense = function (name) { return new Field(undefined, ctx.nbrSensors[name] || {}); };

  // inbox: {neighbourId: message}; returns {value, message} to broadcast.
  exports.device = function (id) {
    var state = {};
    return {
      id: id,
      round: function (program, inbox, sensors, nbrSensors) {
        inbox = inbox || {};
        ctx = {
          id: id, key: String(id), inbox: inbox, dom: Object.keys(inbox),
          sensors: sensors || {}, nbrSensors: nbrSensors || {},
          prev: state, state: {}, msg: {}, path: '', count: 0
        };
        var value = program();
        state = ctx.state;
        var message = ctx.msg;
        ctx = null;
        return { value: value, message: message };
      }
    };
  };

  // JSON turns Infinity/NaN into null, which breaks gradients: tag them instead.
  function walk(v, f) {
    if (!v || typeof v !== 'object') return f(v);
    var o = Array.isArray(v) ? [] : {};
    for (var k in v) o[k] = walk(v[k], f);
    return o;
  }
  exports.encode = function (msg) {
    return JSON.stringify(walk(msg, function (v) {
      return typeof v === 'number' && !isFinite(v) ? '\x01' + v : v;
    }));
  };
  exports.decode = function (str) {
    return walk(JSON.parse(str), function (v) {
      return typeof v === 'string' && v[0] === '\x01' ? Number(v.slice(1)) : v;
    });
  };
})(typeof exports === 'undefined' ? (this.nbrjs = {}) : exports);
