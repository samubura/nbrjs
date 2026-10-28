// Playground examples: program.js (device code) and, when it matters, config.js (simulation).
var PRESETS = [
  { name: 'Gradient (distance)', program:
`// Distance from the nearest source. Click a node to toggle it as source.
var gradient = (src) => share(Infinity, (d) => src ? 0 : d.zip(nbrSense('range'), (a, b) => a + b).min());

var program = () => gradient(sense('source'));` },

  { name: 'Hop count (runs on BLE)', program:
`// Hops from the nearest source: no distance sensor needed. This is examples/hops.js.
var hops = (src) => share(Infinity, (d) => src ? 0 : d.min() + 1);

var program = () => hops(sense('source'));` },

  { name: 'Round counter (rep)', program:
`var program = () => rep(0, (c) => c + 1);` },

  { name: 'Neighbour count (nbr)', program:
`var program = () => nbr(1).sum();` },

  { name: 'Broadcast (closest source id)', program:
`// Share [distance, sourceId] pairs: every node learns which source is closest.
var broadcast = (src, v) => share([Infinity, v], (n) => src ? [0, v] :
  n.zip(nbrSense('range'), (p, r) => [p[0] + r, p[1]])
   .reduce((best, p) => p[0] < best[0] ? p : best, [Infinity, null]));

var program = () => broadcast(sense('source'), id())[1];`,
    config:
`return {
  target: 'sim',
  period: 200,
  nodes: 60, layout: 'random', range: 1.5,
  sources: [0, 7, 52], obstacles: []
};` },

  { name: 'Obstacles (branch)', program:
`// Shift+click toggles obstacles: branch() takes them out of the gradient's domain.
var gradient = (src) => share(Infinity, (d) => src ? 0 : d.zip(nbrSense('range'), (a, b) => a + b).min());

var program = () => branch(sense('obstacle'), () => null, () => gradient(sense('source')));`,
    config:
`return {
  target: 'sim',
  period: 200,
  nodes: 64, layout: 'random', range: 1.5,
  sources: [0], obstacles: [4, 12, 20, 28, 36, 44]
};` },

  { name: 'Local hot spot (sensors from config)', program:
`// 'temp' comes from config.js: a hot spot moving over time.
// Each node checks whether it is the hottest among its neighbours.
var program = () => sense('temp') >= nbr(sense('temp')).max();`,
    config:
`// The simulated environment provides the 'temp' sensor: a hot spot that moves over time.
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

  { name: 'Collect (xc, per-neighbour send)', program:
`// Count the nodes that reach each source. With xc a node sends its partial sum
// to its parent only (the closest neighbour), and 0 to everybody else.
var gradient = (src) => share(Infinity, (d) => src ? 0 : d.zip(nbrSense('range'), (a, b) => a + b).min());

var collect = (dist, v) => {
  var parent = nbr(dist).map((d, id) => [d, id])
    .reduce((best, p) => p[0] < best[0] ? p : best, [dist, null])[1];
  return xc(0, (n) => {
    var total = n.sum(v);
    return retsend(total, n.map((x, id) => id === parent ? total : 0));
  });
};

var program = () => collect(gradient(sense('source')), 1);` },

  { name: 'Link age (xc)', program:
`// Each link counts how many rounds it has lasted: I send every neighbour what it sent me, +1.
// Drag a node somewhere else: its new links start again from 1.
var program = () => xc(0, (n) => n.map((x) => x + 1)).min();` }
];
