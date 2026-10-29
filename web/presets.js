// Playground examples: program.js (device code) and, when it matters, config.js (simulation).
var PRESETS = [
  { name: 'Gradient (distance)', program:
`// Distance from the nearest source. Click a node to make it a source.
// nbrSense('range') is the distance to each neighbour (estimated from the signal on BLE).
var gradient = (src) => share(Infinity, (d) => src ? 0 : d.zip(nbrSense('range'), (a, b) => a + b).min());

var program = () => gradient(sense('source'));` },

  { name: 'Gradient (hops)', program:
`// Hops from the nearest source: no distance needed. Same as hopsTo() in the library.
var hops = (src) => share(Infinity, (d) => src ? 0 : d.min() + 1);

var program = () => hops(sense('source'));` },

  { name: 'Round counter (rep)', test: 'changes', program:
`var program = () => rep(0, (c) => c + 1);` },

  { name: 'Neighbour count (nbr)', program:
`var program = () => nbr(1).sum();` },

  { name: 'Broadcast (nearest source)', program:
`// {dist, value} pairs: every node learns which source is nearest.
var broadcast = (src, v) => share({ dist: Infinity, value: v }, (n) => src ? { dist: 0, value: v } :
  n.zip(nbrSense('range'), (p, r) => ({ dist: p.dist + r, value: p.value }))
   .reduce((best, p) => p.dist < best.dist ? p : best, { dist: Infinity, value: null }));

var program = () => broadcast(sense('source'), id()).value;`,
    config:
`return {
  target: 'sim',
  period: 200,
  nodes: 60, layout: 'random', range: 1.5,
  sources: [0, 7, 52], obstacles: []
};` },

  { name: 'Obstacles (branch)', program:
`// Shift+click makes a node an obstacle: the branch takes it out of the gradient's domain.
var program = () => branch(sense('obstacle'), () => null, () => distanceTo(sense('source')));`,
    config:
`return {
  target: 'sim',
  period: 200,
  nodes: 64, layout: 'random', range: 1.5,
  sources: [0], obstacles: [4, 12, 20, 28, 36, 44]
};` },

  { name: 'Warmest spot (sensors from config.js)', program:
`// 'temp' comes from config.js: a heat source moving over time.
// Each node checks whether it is the warmest among its neighbours.
var program = () => sense('temp') >= nbr(sense('temp')).max();`,
    config:
`// The simulated environment provides the 'temp' sensor: a moving heat source.
return {
  target: 'sim',
  period: 200,
  nodes: 60, layout: 'random', range: 1.5,
  sources: [],
  sensors: (id, x, y, round) => {
    var hx = 4 + 3 * Math.cos(round / 40), hy = 4 + 3 * Math.sin(round / 40);
    return { temp: Math.round(30 - Math.hypot(x - hx, y - hy) * 3) };
  }
};` },

  { name: 'Collect (xc, per-neighbour messages)', program:
`// Counts the nodes that reach each source. With xc each node sends its partial sum
// only to its parent (the neighbour closest to the source), and 0 to everyone else.
var gradient = (src) => share(Infinity, (d) => src ? 0 : d.zip(nbrSense('range'), (a, b) => a + b).min());

var collect = (dist, v) => {
  var parent = nbr(dist).map((d, id) => ({ dist: d, id: id }))
    .reduce((best, c) => c.dist < best.dist ? c : best, { dist: dist, id: null }).id;
  return xc(0, (n) => {
    var total = n.sum(v);
    return retsend(total, n.map((x, id) => id === parent ? total : 0));
  });
};

var program = () => collect(gradient(sense('source')), 1);` },

  { name: 'Leaders and their areas (library)', program:
`// Leaders about 3 apart; each node shows the leader it belongs to.
var program = () => broadcast(isLeader(3), id());` },

  { name: 'Count devices at the source (library)', program:
`// Sums 1 per device towards the source, then shares the total with everyone.
var program = () => {
  var source = sense('source');
  return broadcast(source, collectSum(hopsTo(source), 1));
};` },

  { name: 'Link age (xc)', test: 'changes', program:
`// Each link counts how many rounds it has lasted: I send each neighbour back what it sent me, +1.
// Drag a node elsewhere: its new links start again from 1.
var program = () => xc(0, (n) => n.map((x) => x + 1)).min();` }
];
