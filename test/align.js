// The alignment transform (host side only, needs acorn): rewritten programs align like branch.
var acorn = require('acorn'), T = require('../src/align.js');
var A = require('nbrjs'), sim = require('nbrjs/sim');
var failed = 0;
var check = function (name, actual, expected) {
  var a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log('ok   ' + name);
  else { failed++; console.log('FAIL ' + name + ': got ' + a + ', want ' + e); }
};
// Runs program source the way the playground does: transform, then evaluate with the operators in scope.
var load = function (src) {
  var r = T.transform(src, acorn), env = Object.assign({ require: function () { return A; } }, A);
  var names = Object.keys(env);
  return { program: new Function(names.join(','), r.code + '\nreturn program;').apply(null, names.map(function (k) { return env[k]; })), result: r };
};
var line = function (n) { var pos = {}; for (var i = 0; i < n; i++) pos[i] = [i, 0]; return sim.network(pos, 1.5); };
var run = function (src, n, steps) {
  var net = line(n), p = load(src).program, out;
  for (var i = 0; i < steps; i++) out = net.step(p, {});
  return out;
};
var cat = "var cat = (acc, v) => acc + v;\n";

check('ternary: a neighbour on the other side is not aligned',
  run(cat + "var program = () => id() === '1' ? nbr('B').reduce(cat, '') : nbr('A').reduce(cat, '');", 3, 2),
  { 0: '', 1: '', 2: '' });
check('if: an operator in the arm does not shift the ones after it',
  run(cat + "var program = () => { if (id() === '1') nbr('A'); return nbr('B').reduce(cat, ''); };", 3, 2),
  { 0: 'B', 1: 'BB', 2: 'B' });
check('&&: keeps the value of the left side',
  run(cat + "var program = () => id() !== '1' && nbr('A').reduce(cat, '');", 3, 2),
  { 0: '', 1: false, 2: '' });
check('function identity: f = c ? g : h; f() never mixes g and h',
  run(cat + "var g = () => nbr('G').reduce(cat, '');\nvar h = () => nbr('H').reduce(cat, '');\n" +
    "var program = () => { var f = id() === '1' ? h : g; return f(); };", 3, 2),
  { 0: '', 1: '', 2: '' });
var plain = load("var program = () => sense('a') ? Math.max(1, 2) : nbr(1).sum();").result;
check('only arms that may run operators are rewritten', [plain.changed, /branch/.test(plain.code)], [true, true]);
check('local-only conditionals are left alone', load("var program = () => sense('a') ? Math.max(1, 2) : 3;").result.changed, false);
check('warns about operators inside .map() callbacks',
  load("var program = () => [1, 2].map((x) => nbr(x).sum());").result.warnings.length, 1);

console.log(failed ? failed + ' FAILED' : 'ALL OK');
if (failed) process.exit(1);
