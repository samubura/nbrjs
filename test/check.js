// The alignment check (host side only, needs acorn): warns where native control flow wraps aggregate code.
var acorn = require('acorn'), C = require('../src/check.js');
var failed = 0;
var check = function (name, src, expected) {
  var w = C.check(src, acorn), a = w.length;
  if (a === expected) console.log('ok   ' + name);
  else { failed++; console.log('FAIL ' + name + ': got ' + JSON.stringify(w) + ', want ' + expected + ' warning(s)'); }
};
check('?: around an operator', "var program = () => sense('a') ? nbr(1).sum() : 0;", 1);
check('if around a library function', "var program = () => { if (sense('a')) return hopsTo(true); return 0; };", 1);
check('&& before a user function that calls an operator',
  "var g = () => rep(0, (c) => c + 1);\nvar f = (x) => g() + x;\nvar program = () => sense('a') && f(1);", 1);
check('loop around an operator', "var program = () => { for (var i = 0; i < 3; i++) nbr(i); };", 1);
check('.map() callback around an operator', "var program = () => [1, 2].map((x) => nbr(x).sum());", 1);
check('branch is fine', "var program = () => branch(sense('a'), () => nbr(1).sum(), () => 0);", 0);
check('local-only conditionals are fine', "var clamp = (x) => Math.max(0, x);\nvar program = () => sense('a') ? clamp(3) : 3;", 0);
check('conditionals inside share are fine', "var program = () => share(Infinity, (d) => sense('s') ? 0 : d.min() + 1);", 0);
check('early return without operators is fine', "var program = () => { if (sense('o')) return null; return hopsTo(true); };", 0);
check('a function picked at run time', "var g = () => nbr(1).sum();\nvar h = () => rep(0, (c) => c + 1);\n" +
  "var program = () => { var f = sense('a') ? g : h; return f(); };", 1);
check('picking aggregate()-wrapped or library functions is fine', "var g = aggregate('g', () => nbr(1).sum());\n" +
  "var program = () => { var f = sense('a') ? g : hopsTo; return f(true); };", 0);
check('a wrapped function still needs branch under ?:', "var g = aggregate('g', () => nbr(1).sum());\n" +
  "var program = () => sense('a') ? g() : 0;", 1);
console.log(failed ? failed + ' FAILED' : 'ALL OK');
if (failed) process.exit(1);
