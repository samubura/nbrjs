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

var objNet = line(2), objOut = run(objNet, function () {
  return nbr({ who: id(), hops: 1 }).map(function (p) { return p.who + ':' + p.hops; }).reduce(cat, '');
}, 2);
check('objects travel as arrays of values and arrive as objects',
  [objOut, A.encode(objNet.devices[0].round(function () { return nbr({ who: 'a', hops: 1 }); }, {}).message)],
  [{ 0: '1:1', 1: '0:1' }, '{"x0":[["a",1]]}']);
check('equal objects for every neighbour send no overrides', A.encode(line(3).devices[1].round(function () {
  return xc({ a: 1 }, function (n) { return n.map(function () { return { a: 2 }; }); });
}, { 0: { x0: [[1]] }, 2: { x0: [[1]] } }).message), '{"x0":[[2]]}');
var leaderNet = sim.network(sim.layout('random', 40, 42), 1.5);
var lp = function () { return L.broadcast(L.isLeader(3), id()); };
var settled = JSON.stringify(run(leaderNet, lp, 60));
check('lib: isLeader settles, with loops in the network', JSON.stringify(run(leaderNet, lp, 20)), settled);

// Hashed message keys (BLE) compute the same as readable paths.
var hashedNet = line(5);
for (var hi in hashedNet.devices) hashedNet.devices[hi] = A.device(hi, true);
var grad = function () { return branch(sense('obstacle'), function () { return -1; }, function () {
  return share(Infinity, function (d) { return sense('source') ? 0 : d.min() + 1; }); }); };
var srcs = { 0: { source: true } };
check('hashed keys give the same results', run(hashedNet, grad, 6, srcs), run(line(5), grad, 6, srcs));

// Binary BLE format: round trip, and it is small.
var ble = require('nbrjs/ble');
// Lossy radio: messages lost and rounds missed. A gradient still gets there. (With a short ttl a neighbour
// sometimes expires, and hops briefly rise: as on a real radio.)
var lossy = sim.network(line(6).pos, 1.5, { loss: 0.3, skip: 0.3, ttl: 10 }); // ttl: a neighbour rarely expires
check('sim with loss and skipped rounds: hopsTo still converges', run(lossy, function () { return L.hopsTo(sense('source')); }, 150, src0),
  { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 });

// The simulator with the BLE format: per-neighbour overrides, float32, the 23-byte limit.
var bleLine = function (n) { var l = line(n); return sim.network(l.pos, 1.5, { codec: sim.bleCodec() }); };
check('sim over BLE: collectSum counts the line', run(bleLine(5), function () {
  var s = sense('source');
  return L.collectSum(L.hopsTo(s), 1);
}, 20, src0)[0], 5);
var bleLeaders = sim.network(sim.layout('random', 40, 42), 1.5, { codec: sim.bleCodec() });
var bleSettled = JSON.stringify(run(bleLeaders, lp, 60));
check('sim over BLE: isLeader settles', JSON.stringify(run(bleLeaders, lp, 20)), bleSettled);
check('sim over BLE: leader messages fit an advert', Object.keys(bleLeaders.messages).filter(function (i) {
  return bleLeaders.messages[i] === '';
}).length, 0);
check('sim over BLE: a message over 23 bytes is not sent', run(bleLine(2), function () {
  return nbr('a string much too long for an advert').reduce(count, 0);
}, 2), { 0: 0, 1: 0 });
var rich = {};
rich[A.hash('b0.1')] = 1;
rich[A.hash('b0.1/x0')] = [Infinity, { '170': 3, '48879': -2.5 }];
rich[A.hash('x1')] = [NaN];
rich[A.hash('x2')] = [null];
rich[A.hash('x3')] = [-100000];
rich[A.hash('x4')] = ['hi'];
rich[A.hash('x5')] = [[1, true]];
var back = ble.unpack(ble.pack(rich));
check('ble binary format round-trips', [A.encode(back), isNaN(back[A.hash('x1')][0])], [A.encode(rich), true]);
var ints = [64, 8191, 40963, 100000, -70000, 2147483647, -2147483648];
check('ble integers round-trip exactly', ints.map(function (v) { return ble.unpack(ble.pack({ 1: [v] }))[1][0]; }), ints);
var hop = {};
hop[A.hash('x0')] = [7];
check('ble message sizes', [ble.pack(hop).length, ble.pack(rich).length], [3, 40]);

check('groups: a first byte per group, printable, N without one', [A.magic(), A.magic('swarm') === A.magic('swarm'),
  A.magic('swarm') !== A.magic('robots'), A.magic('swarm').charCodeAt(0) > 32 && A.magic('swarm').charCodeAt(0) < 127], ['N', true, true, true]);

check('lib: collect with max and sum', run(line(5), function () {
  var d = L.hopsTo(sense('source'));
  return [L.collect(d, +id() * 10, Math.max, -Infinity), L.collectSum(d, 1)];
}, 20, src0)[0], [40, 5]);

// A source that goes away: hops climb for ever, unless bounded by max.
var gone = function (max) {
  var net = line(6), p = function () { return L.hopsTo(sense('source'), max); };
  run(net, p, 15, src0);
  var a = run(net, p, 25, {}), b = run(net, p, 25, {});
  return [a[5] === b[5], b[5] === Infinity];
};
check('lib: hopsTo with max stops climbing when the source goes away', [gone(), gone(8)], [[false, false], [true, true]]);

var nan = A.decode(A.encode({ x0: [NaN, { 1: [1, NaN] }] }));
check('NaN survives JSON', [isNaN(nan.x0[0]), nan.x0[1][1][0], isNaN(nan.x0[1][1][1])], [true, 1, true]);

// BLE transport against a fake NRF (no radio here): hears a neighbour, advertises a compact message.
var adv = null, onScan = null;
NRF = {
  getAddress: function () { return 'aa:bb:cc:dd:00:01 public'; },
  setScan: function (cb) { if (cb) onScan = cb; },
  setAdvertising: function (d, o) { if (Array.isArray(d)) adv = d; else if (o) adv = o; },
  getAdvertisingData: function (d, o) { return o.manufacturerData; }
};
if (typeof getTime === 'undefined') getTime = function () { return Date.now() / 1000; };
var bytes = function (s) { var b = []; for (var i = 0; i < s.length; i++) b.push(s.charCodeAt(i)); return b; };
var link = A.start(function () {
  return [nbr(id()).reduce(function (acc, v) { return acc + v; }, ''), Math.round(A.nbrSense('range').min() * 100) / 100];
}, { target: 'ble', period: 1e6, scan: 1e6 });
var m2 = {};
m2[A.hash('x0')] = [2];
onScan({ id: 'aa:bb:cc:dd:00:02 public', rssi: -50, manufacturer: 0x0590, manufacturerData: bytes('N' + ble.pack(m2)) });
onScan({ id: 'aa:bb:cc:dd:00:03 public', rssi: -50, manufacturer: 0x004c, manufacturerData: bytes('Nxx') });
onScan({ id: 'aa:bb:cc:dd:00:04 public', rssi: -50, manufacturer: 0x0590, manufacturerData: bytes(A.magic('other') + ble.pack(m2)) });
var r = link.round();
link.stop();
check('ble hears neighbours and advertises compactly', [link.id, r.value[0], r.value[1], ble.unpack(adv.manufacturerData.slice(1))[A.hash('x0')], adv.manufacturerData.length],
  [1, '2', 0.32, [1], 1 + 2 + 1]);

var clash = sim.network(line(3).pos, 1.5, { codec: sim.bleCodec() }); // 'a0:k/x0' and 'a1:4634/x0' have the same 2-byte hash
run(clash, function () { return [align('k', function () { return nbr(1).sum(); }), align(4634, function () { return nbr(2).sum(); })]; }, 2);
check('sim over BLE: paths sharing a hash are reported', clash.collisions, [['a0:k', 'a1:4634'], ['a0:k/x0', 'a1:4634/x0']]);
var seed = clash.freeSeed(), unclash = sim.network(line(3).pos, 1.5, { codec: sim.bleCodec({ hashSeed: seed }) });
var clashing = function () { return [align('k', function () { return nbr(1).sum(); }), align(4634, function () { return nbr(2).sum(); })]; };
check('sim over BLE: the suggested hashSeed removes the collision', [seed > 0, unclash.collisions, run(unclash, clashing, 3)[1]],
  [true, [], [2, 4]]);

var seeded = A.start(function () { return nbr(1).sum(); }, { target: 'ble', period: 1e6, scan: 1e6, hashSeed: 5 });
seeded.round();
seeded.stop();
check('ble with hashSeed: names hashed with the seed', Object.keys(ble.unpack(adv.manufacturerData.slice(1))), [A.hash('x0', 5)]);
var wide = A.start(function () { return nbr(1).sum(); }, { target: 'ble', period: 1e6, scan: 1e6, hashBytes: 3 });
wide.round();
wide.stop();
check('ble with hashBytes: 3-byte names', [Object.keys(ble.unpack(adv.manufacturerData.slice(1), 3)), adv.manufacturerData.length], [[A.hash('x0', 0, 3)], 1 + 3 + 1]);

// Operator names in 1 or 3 bytes instead of 2: the same results, a byte less or more per operator.
var widths = [1, 2, 3].map(function (kb) {
  var m = {};
  m[A.hash('x0', 0, kb)] = [5];
  m[A.hash('b0.1', 0, kb)] = 1;
  var p = ble.pack(m, kb);
  return [p.length, A.encode(ble.unpack(p, kb)) === A.encode(m)];
});
check('ble keys of 1, 2 or 3 bytes round-trip', widths, [[4, true], [6, true], [8, true]]);
var hops3 = function (kb) {
  return run(sim.network(line(5).pos, 1.5, { codec: sim.bleCodec({ hashBytes: kb }) }), function () { return L.hopsTo(sense('source')); }, 8, src0);
};
check('sim over BLE with 1- and 3-byte names', [hops3(1), hops3(3)], [run(line(5), function () { return L.hopsTo(sense('source')); }, 8, src0), run(line(5), function () { return L.hopsTo(sense('source')); }, 8, src0)]);

// Messages over 23 bytes: chunks of whole entries, advertised in turn, merged by the receiver.
var four = function () { return [nbr(1.5).sum(), nbr(2.5).sum(), nbr(3.5).sum(), nbr(4.5).sum()]; };
var m4 = {};
['x0', 'x1', 'x2', 'x3'].forEach(function (p, i) { m4[A.hash(p)] = [10 * (i + 1) + 0.5]; });
var cs = ble.split(m4, 4), joined = {};
cs.forEach(function (c) { var e = ble.unpack(c); for (var k in e) joined[k] = e[k]; });
check('ble split: chunks of whole entries that fit', [cs.length, cs.every(function (c) { return c.length <= 22; }), A.encode(joined)], [2, true, A.encode(m4)]);
var big = A.start(four, { target: 'ble', period: 1e6, scan: 1e6 });
var chunk = function (round, c) {
  onScan({ id: 'aa:bb:cc:dd:00:02 public', rssi: -50, manufacturer: 0x0590, manufacturerData: bytes(String.fromCharCode(78 | 128, round) + c) });
};
chunk(5, cs[0]);
var r1 = big.round().value;
chunk(5, cs[1]);
var r2 = big.round().value;
var m5 = {};
m5[A.hash('x0')] = [11.5];
chunk(6, ble.split(m5, 4)[0]); // round 6, first chunk only: x1..x3 stay from round 5
var r3 = big.round().value;
big.stop();
check('ble chunks: merged per round, missing ones kept from the round before',
  [r1, r2, r3, adv.length, adv[0].charCodeAt(0)], [[10.5, 20.5, 30.5, 0], [10.5, 20.5, 30.5, 40.5], [11.5, 20.5, 30.5, 40.5], 2, 78 | 128]);
var chunkNet = sim.network(line(5).pos, 1.5, { codec: sim.bleCodec() });
var bigProgram = function () { return [L.hopsTo(sense('source')), nbr(1.5).sum(), nbr(2.5).sum(), nbr(3.5).sum()]; };
check('sim over BLE: a message over 23 bytes goes in chunks', [run(chunkNet, bigProgram, 10, src0), chunkNet.messages[2].length],
  [run(line(5), bigProgram, 10, src0), 2]);

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

// UDP with positions: neighbours within range, and their distance as nbrSense('range').
var onMsg2 = null;
var sock2 = { on: function (e, cb) { onMsg2 = cb; }, bind: function () {}, close: function () {}, send: function () {} };
var udp2 = A.start(function () { return [nbr(id()).reduce(function (acc, v) { return acc + v; }, ''), A.nbrSense('range').min()]; },
  { target: 'udp', id: 'r1', period: 1e6, socket: sock2, position: function () { return [0, 0]; }, range: 6 });
udp2.round();
onMsg2('Nr2@3,4 ' + A.encode({ x0: ['r2'] }));
onMsg2('Nr3@10,0 ' + A.encode({ x0: ['r3'] }));
var ru2 = udp2.round();
udp2.stop();
check('udp with positions keeps neighbours within range', ru2.value, ['r2', 5]);

// Host target: the PC sends the inbox as JSON, the board answers with one line.
var host = A.start(() => nbr(1).sum(), { target: 'host' });
var line1 = nbrjsRound(A.encode({ inbox: { 7: { x0: [1] } }, nbr: {} }));
host.stop();
check('host answers the PC with one line', line1, 'NBR{"id":"puck","v":1,"m":{"x0":[1]},"s":{}}');

console.log(failed ? failed + ' FAILED' : 'ALL OK');
if (failed && typeof process !== 'undefined' && process.exit) process.exit(1);
var result = !failed; // read by `espruino --test`
