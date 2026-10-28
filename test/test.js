// Assert-based tests, runnable on Node and on the Espruino Linux build.
var A = require('../src/core.js');
var sim = require('../src/sim.js');
var nbr = A.nbr, rep = A.rep, share = A.share, xc = A.xc,
    retsend = A.retsend, branch = A.branch, mid = A.mid, sense = A.sense;

var failed = 0;
var check = function (name, actual, expected) {
  var a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log('ok   ' + name);
  else { failed++; console.log('FAIL ' + name + ': got ' + a + ', want ' + e); }
};
var run = function (net, program, steps, sensors) {
  var out;
  for (var i = 0; i < steps; i++) out = net.step(program, sensors);
  return out;
};
var line = function (n) {
  var pos = {};
  for (var i = 0; i < n; i++) pos[i] = [i, 0];
  return sim.network(pos, 1.5);
};
var count = function (acc) { return acc + 1; };
var gradient = function (src) {
  return share(Infinity, function (d) {
    return src ? 0 : d.zip(A.nbrSense('range'), function (a, b) { return a + b; }).reduce(Math.min, Infinity);
  });
};

check('nbr sees neighbour ids', run(line(3), function () {
  return nbr(mid()).reduce(function (acc, v) { return acc + v; }, '');
}, 2), { 0: '1', 1: '02', 2: '1' });

check('nbr self is current value', run(line(2), function () {
  return nbr(mid()).self;
}, 2), { 0: '0', 1: '1' });

check('rep counts rounds', run(line(2), function () {
  return rep(0, function (c) { return c + 1; });
}, 3), { 0: 3, 1: 3 });

check('gradient converges on a line', run(line(5), function () {
  return gradient(mid() === '0');
}, 6), { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 });

var sides = { 0: { left: true }, 1: { left: true }, 2: { left: false }, 3: { left: false } };
check('branch partitions the domain', run(line(4), function () {
  return branch(sense('left'),
    function () { return nbr(1).reduce(count, 0); },
    function () { return nbr(1).reduce(count, 0); });
}, 2, sides), { 0: 1, 1: 1, 2: 1, 3: 1 });

check('fields from outside a branch fold on the branch domain', run(line(4), function () {
  var n = nbr(1);
  return branch(sense('left'),
    function () { return n.reduce(count, 0); },
    function () { return n.reduce(count, 0); });
}, 2, sides), { 0: 1, 1: 1, 2: 1, 3: 1 });

// Round 1 knows no neighbours (default only), round 2 sends overrides, round 3 receives them.
check('xc sends a different value to each neighbour', run(line(3), function () {
  return xc('', function (n) {
    return retsend(n.reduce(function (acc, v) { return acc + v + ' '; }, ''),
      n.map(function (v, id) { return mid() + '>' + id; }));
  });
}, 3), { 0: '1>0 ', 1: '0>1 2>1 ', 2: '1>2 ' });

check('encode/decode keeps Infinity', A.decode(A.encode({ a: [Infinity, -Infinity, 1, 'x'] })).a[1] === -Infinity &&
  A.decode(A.encode([Infinity]))[0] === Infinity, true);

console.log(failed ? failed + ' FAILED' : 'ALL OK');
if (failed && typeof process !== 'undefined' && process.exit) process.exit(1);
var result = !failed; // read by `espruino --test`
