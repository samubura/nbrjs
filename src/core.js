// Minimal aggregate computing core with eXchange Calculus (XC) semantics.
// Espruino-safe subset: no Map/Set, destructuring, spread, default params,
// for...of or function hoisting (helpers are defined before use).
(function (exports) {
  // The round being evaluated. JS is single-threaded, so programs are plain
  // zero-argument functions that read it implicitly.
  var ctx = null;

  // A neighbouring value (XC nvalue): default `d`, per-device overrides `o`, and the
  // neighbours `n` it is aligned with (an object used as a set; null = everywhere).
  function Field(d, o, n) {
    this.d = d;
    this.o = o;
    this.n = n || null;
    this.self = ctx.key in o ? o[ctx.key] : d;
  }
  Field.prototype.at = function (id) {
    return id in this.o ? this.o[id] : this.d;
  };
  Field.prototype.map = function (fn) {
    var o = {};
    for (var k in this.o) o[k] = fn(this.o[k], k);
    return new Field(fn(this.d), o, this.n);
  };
  Field.prototype.zip = function (other, fn) {
    var f = lift(other), o = {}, k;
    for (k in this.o) o[k] = fn(this.o[k], f.at(k));
    for (k in f.o) if (!(k in o)) o[k] = fn(this.d, f.o[k]);
    var n = this.n && f.n ? {} : this.n || f.n;
    if (this.n && f.n) for (k in this.n) if (k in f.n) n[k] = 1;
    return new Field(fn(this.d, f.d), o, n);
  };
  // Folds over the neighbours aligned with both the field and the current branch,
  // self excluded (XC nfold). The reducer gets only (acc, v): Math.min / Math.max work as-is.
  Field.prototype.reduce = function (fn, acc) {
    var dom = ctx.dom, n = this.n;
    for (var i = 0; i < dom.length; i++) if (!n || dom[i] in n) acc = fn(acc, this.at(dom[i]));
    return acc;
  };
  // Shorthands: d.min() + 1, nbr(1).sum(). Optional base for empty neighbourhoods.
  Field.prototype.min = function (b) { return this.reduce(Math.min, b === undefined ? Infinity : b); };
  Field.prototype.max = function (b) { return this.reduce(Math.max, b === undefined ? -Infinity : b); };
  Field.prototype.sum = function (b) { return this.reduce(function (a, v) { return a + v; }, b || 0); };

  function lift(v) {
    return v instanceof Field ? v : new Field(v, {});
  }

  function RetSend(ret, send) {
    this.ret = ret;
    this.send = send;
  }

  // Paths are message keys: kept short ("x0", "b1.1/x0") since BLE adverts carry ~23 bytes.
  function sub(token) {
    return ctx.path ? ctx.path + '/' + token : token;
  }
  function next(kind) {
    return sub(kind + ctx.count++);
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
    var r = fn(new Field(init, o, o));
    var ret = r instanceof RetSend ? r.ret : r;
    var s = lift(r instanceof RetSend ? r.send : r);
    var ov = null;
    for (var k in s.o) if (k !== c.key && s.o[k] !== s.d) { ov = ov || {}; ov[k] = s.o[k]; }
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
    return scoped(sub('a:' + key), fn);
  };
  exports.mid = function () { return ctx.id; };
  exports.sense = function (name) { return ctx.sensors[name]; };
  exports.nbrSense = function (name) {
    var s = ctx.nbrSensors[name] || {};
    return new Field(undefined, s, s);
  };

  // Transports register here (nbrjs/ble, nbrjs/sim). The same program runs on a real network
  // or in simulation depending only on the config: start(program, {target: 'ble', period: 1000}).
  exports.targets = {};
  exports.start = function (program, cfg) {
    var t = exports.targets[cfg.target];
    if (!t && typeof require === 'function') t = require('nbrjs/' + cfg.target);
    if (!t) throw new Error('nbrjs: unknown target ' + cfg.target);
    return t.start(program, cfg);
  };

  // require('nbrjs').globals() then write nbr(1).sum(): Espruino has no destructuring import.
  exports.globals = function () {
    var g = typeof globalThis !== 'undefined' ? globalThis : global;
    'xc retsend nbr rep share branch align mid sense nbrSense start'.split(' ').forEach(function (k) { g[k] = exports[k]; });
    return exports;
  };

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

  // JSON turns ±Infinity into null, which breaks gradients: write ±1e999 instead,
  // valid JSON that parses back to ±Infinity and is short enough for BLE. NaN stays null.
  function mark(v) {
    if (v === Infinity) return '~inf~';
    if (v === -Infinity) return '~-inf~';
    if (!v || typeof v !== 'object') return v;
    var o = Array.isArray(v) ? [] : {};
    for (var k in v) o[k] = mark(v[k]);
    return o;
  }
  exports.encode = function (msg) {
    return JSON.stringify(mark(msg)).split('"~inf~"').join('1e999').split('"~-inf~"').join('-1e999');
  };
  exports.decode = function (str) { return JSON.parse(str); };
})(typeof exports === 'undefined' ? (this.nbrjs = {}) : exports);
