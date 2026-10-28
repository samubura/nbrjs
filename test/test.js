// Assert-based tests, runnable on Node and on the Espruino Linux build.
var A = require('nbrjs');
var sim = require('nbrjs/sim');
var nbr = A.nbr, rep = A.rep, share = A.share, xc = A.xc,
    retsend = A.retsend, branch = A.branch, id = A.id, sense = A.sense;

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
var gradient = (src) => share(Infinity, (d) => src ? 0 : d.zip(A.nbrSense('range'), (a, b) => a + b).min());

check('nbr sees neighbour ids', run(line(3), function () {
  return nbr(id()).reduce(function (acc, v) { return acc + v; }, '');
}, 2), { 0: '1', 1: '02', 2: '1' });

check('nbr self is current value', run(line(2), function () {
  return nbr(id()).self;
}, 2), { 0: '0', 1: '1' });

check('rep counts rounds', run(line(2), function () {
  return rep(0, function (c) { return c + 1; });
}, 3), { 0: 3, 1: 3 });

check('gradient converges on a line', run(line(5), function () {
  return gradient(id() === '0');
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

check('neighbours skipping an operator are not aligned with it', run(line(3), function () {
  return id() === '1' ? -1 : nbr(1).sum();
}, 2), { 0: 0, 1: -1, 2: 0 });

// Round 1 knows no neighbours (default only), round 2 sends overrides, round 3 receives them.
check('xc sends a different value to each neighbour', run(line(3), function () {
  return xc('', function (n) {
    return retsend(n.reduce(function (acc, v) { return acc + v + ' '; }, ''),
      n.map(function (v, j) { return id() + '>' + j; }));
  });
}, 3), { 0: '1>0 ', 1: '0>1 2>1 ', 2: '1>2 ' });

check('field shorthands', run(line(3), () => [nbr(1).sum(), nbr(+id()).max(), nbr(+id()).min()], 2),
  { 0: [1, 1, 1], 1: [2, 2, 0], 2: [1, 1, 1] });

A.globals();
check('globals() exposes the operators', run(line(2), () => nbr(1).sum() + rep(0, (c) => c + 1), 2), { 0: 3, 1: 3 });

check('encode/decode keeps Infinity', A.decode(A.encode({ a: [Infinity, -Infinity, 1, 'x'] })).a[1] === -Infinity &&
  A.decode(A.encode([Infinity]))[0] === Infinity, true);

// Same program, different target: only the config changes.
var got = {};
var h = A.start(() => nbr(1).sum(), { target: 'sim', layout: 'line', nodes: 3, period: 1e6,
  onResult: (v, id) => { got[id] = v; } });
h.round(); h.round(); h.stop();
check('start() runs on the sim target', got, { 0: 1, 1: 2, 2: 1 });

// BLE transport against a fake NRF (no radio here): hears a neighbour, advertises a compact message.
var adv = null, onScan = null;
NRF = {
  getAddress: function () { return 'aa:bb:cc:dd:00:01 public'; },
  setScan: function (cb) { onScan = cb; },
  setAdvertising: function (d, o) { if (o) adv = o; }
};
if (typeof getTime === 'undefined') getTime = function () { return Date.now() / 1000; };
var bytes = function (s) { var b = []; for (var i = 0; i < s.length; i++) b.push(s.charCodeAt(i)); return b; };
var link = A.start(function () {
  return nbr(id()).reduce(function (acc, v) { return acc + v; }, '');
}, { target: 'ble', period: 1e6 });
onScan({ id: 'aa:bb:cc:dd:00:02 public', rssi: -50, manufacturer: 0x0590, manufacturerData: bytes('N' + A.encode({ x0: ['0002'] })) });
onScan({ id: 'aa:bb:cc:dd:00:03 public', rssi: -50, manufacturer: 0x004c, manufacturerData: bytes('Nxx') });
var r = link.round();
link.stop();
check('ble hears neighbours and advertises compactly', [link.id, r.value, adv.manufacturerData], ['0001', '0002', 'N{"x0":["0001"]}']);

console.log(failed ? failed + ' FAILED' : 'ALL OK');
if (failed && typeof process !== 'undefined' && process.exit) process.exit(1);
var result = !failed; // read by `espruino --test`
