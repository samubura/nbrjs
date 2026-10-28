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

check('align: the same key twice is two scopes', run(line(1), function () {
  return [A.align('k', function () { return rep(0, function (x) { return x + 1; }); }),
    A.align('k', function () { return rep(100, function (x) { return x + 1; }); })];
}, 3)[0], [3, 103]);
check('branch without else', run(line(2), function () {
  return branch(id() === '0', function () { return nbr(1).sum(); });
}, 2), { 0: 0, 1: undefined });

var cat = function (acc, v) { return acc + v; };
var fa = A.aggregate('fa', function () { return nbr('A').reduce(cat, ''); });
var fb = A.aggregate('fb', function () { return nbr('B').reduce(cat, ''); });
check('aggregate: different functions never align', run(line(3), function () {
  return (id() === '1' ? fb : fa)();
}, 2), { 0: '', 1: '', 2: '' });
// What the alignment transform emits for: if (id() === '1') nbr('A'); return nbr('B').reduce(cat, '');
check('enterIf/exit: an operator inside an if does not shift the ones after it', run(line(3), function () {
  if (A.enterIf(id() === '1')) { try { nbr('A'); } finally { A.exit(); } } else { try { } finally { A.exit(); } }
  return nbr('B').reduce(cat, '');
}, 2), { 0: 'B', 1: 'BB', 2: 'B' });

// Standard library.
var L = require('nbrjs/lib');
var src0 = { 0: { source: true } };
check('lib: hopsTo, distanceTo, broadcast', run(line(5), function () {
  var s = sense('source');
  return [L.hopsTo(s), L.distanceTo(s), L.broadcast(s, 'hi'), L.broadcast(false, 'x')];
}, 8, src0), { 0: [0, 0, 'hi', null], 1: [1, 1, 'hi', null], 2: [2, 2, 'hi', null], 3: [3, 3, 'hi', null], 4: [4, 4, 'hi', null] });
check('lib: collectSum counts the devices at the source', run(line(5), function () {
  return L.collectSum(L.hopsTo(sense('source')), 1);
}, 12, src0)[0], 5);
check('lib: networkMax/Min, neighbourCount, rounds, countdown', run(line(4), function () {
  return [L.networkMax(+id()), L.networkMin(+id()), L.neighbourCount(), L.rounds(), L.countdown(3)];
}, 5)[0], [3, 0, 1, 5, 0]);
var leaders = run(line(9), function () { return L.isLeader(2.5); }, 12);
var lead = Object.keys(leaders).filter(function (k) { return leaders[k]; }).map(Number);
check('lib: isLeader picks spread-out leaders', lead.length > 0 && lead.every(function (a) {
  return lead.every(function (b) { return a === b || Math.abs(a - b) > 1; }); // never two neighbouring leaders
}), true);

// Hashed message keys (BLE) compute the same as readable paths.
var hashedNet = line(5);
for (var hi in hashedNet.devices) hashedNet.devices[hi] = A.device(hi, true);
var grad = function () { return branch(sense('obstacle'), function () { return -1; }, function () {
  return share(Infinity, function (d) { return sense('source') ? 0 : d.min() + 1; }); }); };
var srcs = { 0: { source: true } };
check('hashed keys give the same results', run(hashedNet, grad, 6, srcs), run(line(5), grad, 6, srcs));

// Binary BLE format: round trip, and it is small.
var ble = require('nbrjs/ble');
var rich = {};
rich[A.hash('b0.1')] = 1;
rich[A.hash('b0.1/x0')] = [Infinity, { '00aa': 3, 'beef': -2.5 }];
rich[A.hash('x1')] = [NaN];
rich[A.hash('x2')] = [null];
rich[A.hash('x3')] = [-100000];
rich[A.hash('x4')] = ['hi'];
rich[A.hash('x5')] = [[1, true]];
var back = ble.unpack(ble.pack(rich));
check('ble binary format round-trips', [A.encode(back), isNaN(back[A.hash('x1')][0])], [A.encode(rich), true]);
var hop = {};
hop[A.hash('x0')] = [7];
check('ble message sizes', [ble.pack(hop).length, ble.pack(rich).length], [3, 49]);

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
var m2 = {};
m2[A.hash('x0')] = ['0002'];
onScan({ id: 'aa:bb:cc:dd:00:02 public', rssi: -50, manufacturer: 0x0590, manufacturerData: bytes('N' + ble.pack(m2)) });
onScan({ id: 'aa:bb:cc:dd:00:03 public', rssi: -50, manufacturer: 0x004c, manufacturerData: bytes('Nxx') });
var r = link.round();
link.stop();
check('ble hears neighbours and advertises compactly', [link.id, r.value, ble.unpack(adv.manufacturerData.slice(1))[A.hash('x0')], adv.manufacturerData.length],
  ['0001', '0002', ['0001'], 1 + 2 + 2 + 6]);

// UDP over WiFi against a fake socket: hears a neighbour, ignores itself, broadcasts its message.
var sent = null, onMsg = null;
var fakeSock = { on: function (e, cb) { onMsg = cb; }, bind: function () {}, close: function () {},
  send: function (d, port, addr) { sent = [d, port, addr]; } };
var udp = A.start(function () { return nbr(id()).reduce(function (acc, v) { return acc + v; }, ''); },
  { target: 'udp', id: 'aa', period: 1e6, socket: fakeSock });
onMsg('Nbb ' + A.encode({ x0: ['bb'] }));
onMsg('Naa ' + A.encode({ x0: ['self'] }));
onMsg('garbage');
var ru = udp.round();
udp.stop();
check('udp hears neighbours and broadcasts', [ru.value, sent], ['bb', ['Naa {"x0":["aa"]}', 4210, '255.255.255.255']]);

// Host target: the PC sends the inbox as JSON, the board answers with one line.
var host = A.start(() => nbr(1).sum(), { target: 'host' });
var line1 = nbrjsRound(A.encode({ inbox: { 7: { x0: [1] } }, nbr: {} }));
host.stop();
check('host answers the PC with one line', line1, 'NBR{"id":"puck","v":1,"m":{"x0":[1]}}');

console.log(failed ? failed + ' FAILED' : 'ALL OK');
if (failed && typeof process !== 'undefined' && process.exit) process.exit(1);
var result = !failed; // read by `espruino --test`
