// Every example on the site (embeds, solutions, presets) runs in the simulator, in JSON and in the
// BLE format: no errors, no alignment warnings, and it settles. data-test="changes" / "warns" (or
// test: in a preset) marks the examples that keep changing or are wrong on purpose.
var fs = require('fs'), path = require('path'), vm = require('vm');
var root = path.join(__dirname, '..'), web = path.join(root, 'web');
var A = require('nbrjs'), S = require('nbrjs/sim'), L = require('nbrjs/lib'), B = require('nbrjs/ble');
var C = require('../src/check.js'), acorn = require('acorn');
var OPS = ['xc', 'retsend', 'nbr', 'rep', 'share', 'branch', 'align', 'aggregate', 'id', 'sense', 'nbrSense'];
var LIBK = Object.keys(L).filter(function (k) { return k !== 'globals'; });
var failed = 0, total = 0;
var fail = function (label, why) { failed++; console.log('FAIL ' + label + ': ' + why); };
var unesc = function (s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); };

var boot = function (code) {
  var names = OPS.concat(LIBK, ['require']);
  var vals = OPS.map(function (k) { return A[k]; }).concat(LIBK.map(function (k) { return L[k]; }), [function () { return A; }]);
  var p = new Function(names.join(','), code + '\n;return typeof program === "function" ? program : undefined;').apply(null, vals);
  if (typeof p !== 'function') throw new Error('no program');
  return p;
};
var settles = function (p, attrs, codec) {
  var pos = S.layout(attrs.layout || 'random', +(attrs.nodes || 40), 42), net = S.network(pos, 1.5, { codec: codec }), sens = {};
  var src = attrs.sources === '' ? [] : String(attrs.sources || '0').split(',').map(Number);
  var obs = String(attrs.obstacles || '').split(',').filter(Boolean).map(Number);
  for (var id in pos) sens[id] = { source: src.indexOf(+id) >= 0, obstacle: obs.indexOf(+id) >= 0, x: pos[id][0], y: pos[id][1], temp: 20 + Math.round(pos[id][0]), light: 0.5 };
  var out, k;
  for (k = 0; k < 60; k++) out = net.step(p, sens);
  var a = JSON.stringify(out);
  for (k = 0; k < 20; k++) out = net.step(p, sens);
  return JSON.stringify(out) === a;
};
var run = function (label, code, attrs) {
  total++;
  try {
    var w = C.check(code, acorn), p = boot(code);
    if (w.length && attrs.test !== 'warns') return fail(label, w.join('; '));
    if (!w.length && attrs.test === 'warns') return fail(label, 'expected an alignment warning');
    if (attrs.test === 'changes') return;
    if (!settles(p, attrs)) return fail(label, 'does not settle');
    if (!settles(p, attrs, B.sim)) return fail(label, 'does not settle over BLE');
  } catch (e) { fail(label, e.message); }
};

fs.readdirSync(web).filter(function (f) { return /\.html$/.test(f); }).sort().forEach(function (f) {
  var html = fs.readFileSync(path.join(web, f), 'utf8'), lastDefs = '', lastAttrs = {}, i = 0, m;
  var re = /<div class="pg-embed"([^>]*)>\s*<script type="text\/plain">([\s\S]*?)<\/script>|<pre><code>([\s\S]*?)<\/code><\/pre>/g;
  while ((m = re.exec(html))) {
    if (m[2] !== undefined) {
      var attrs = {};
      m[1].replace(/data-(\w+)="([^"]*)"/g, function (_, k, v) { attrs[k] = v; });
      run(f + ' #' + (++i), m[2], attrs);
      lastDefs = m[2].split(/^var program/m)[0];
      lastAttrs = attrs;
    } else if (/var program/.test(m[3])) {
      // Solutions: each chunk with a program runs after the definitions of the embed above.
      var defs = lastDefs, solAttrs = { layout: lastAttrs.layout, nodes: lastAttrs.nodes, sources: lastAttrs.sources, obstacles: lastAttrs.obstacles,
        test: lastAttrs.test === 'changes' ? 'changes' : undefined };
      unesc(m[3]).split(/\n\n/).forEach(function (chunk, j) {
        if (/var program/.test(chunk)) run(f + ' solution ' + (j + 1), defs + '\n' + chunk, solAttrs);
        else defs += '\n' + chunk;
      });
    }
  }
});
var g = {};
vm.runInNewContext(fs.readFileSync(path.join(web, 'presets.js'), 'utf8') + ';this.P = PRESETS', g);
// The Puck demos: ['name', "program"] pairs in puck.html's script, with its simulated neighbours.
var puck = fs.readFileSync(path.join(web, 'puck.html'), 'utf8').match(/var demos = (\[[\s\S]*?\n  \])/)[1];
vm.runInNewContext('this.D = ' + puck, g);
g.D.forEach(function (d) { g.P.push({ name: 'puck: ' + d[0], program: d[1], config: "return { nodes: 24, layout: 'random', sources: [] };" }); });
g.P.forEach(function (p) {
  var attrs = { test: p.test };
  if (p.config) {
    var c = new Function(p.config)();
    attrs.nodes = c.nodes; attrs.layout = c.layout; attrs.sources = (c.sources || [0]).join(','); attrs.obstacles = (c.obstacles || []).join(',');
  }
  run('preset: ' + p.name, p.program, attrs);
});

console.log(failed ? failed + ' of ' + total + ' examples FAILED' : 'ALL ' + total + ' examples OK');
if (failed) process.exit(1);
