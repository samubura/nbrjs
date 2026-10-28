// Playground examples: program.js (device code) and, when it matters, config.js (simulation).
var PRESETS = [
  { name: 'Gradiente (distanza)', program:
`// Distanza dalla sorgente più vicina. Clicca un nodo per renderlo sorgente.
// nbrSense('range') esiste solo nel simulatore: sui dispositivi usa i salti o l'RSSI.
var gradient = (src) => share(Infinity, (d) => src ? 0 : d.zip(nbrSense('range'), (a, b) => a + b).min());

var program = () => gradient(sense('source'));` },

  { name: 'Gradiente (salti)', program:
`// Salti dalla sorgente più vicina: non serve un sensore di distanza, gira uguale sui dispositivi.
var hops = (src) => share(Infinity, (d) => src ? 0 : d.min() + 1);

var program = () => hops(sense('source'));` },

  { name: 'Contatore dei round (rep)', program:
`var program = () => rep(0, (c) => c + 1);` },

  { name: 'Numero di vicini (nbr)', program:
`var program = () => nbr(1).sum();` },

  { name: 'Broadcast (sorgente più vicina)', program:
`// Coppie [distanza, id sorgente]: ogni nodo scopre qual è la sorgente più vicina.
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

  { name: 'Ostacoli (branch)', program:
`// Shift+click su un nodo lo rende ostacolo: branch() lo toglie dal dominio del gradiente.
var gradient = (src) => share(Infinity, (d) => src ? 0 : d.zip(nbrSense('range'), (a, b) => a + b).min());

var program = () => branch(sense('obstacle'), () => null, () => gradient(sense('source')));`,
    config:
`return {
  target: 'sim',
  period: 200,
  nodes: 64, layout: 'random', range: 1.5,
  sources: [0], obstacles: [4, 12, 20, 28, 36, 44]
};` },

  { name: 'Punto caldo (sensori da config.js)', program:
`// 'temp' arriva da config.js: una fonte di calore che si sposta nel tempo.
// Ogni nodo controlla se è il più caldo fra i suoi vicini.
var program = () => sense('temp') >= nbr(sense('temp')).max();`,
    config:
`// L'ambiente simulato fornisce il sensore 'temp': una fonte di calore in movimento.
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

  { name: 'Collect (xc, messaggi per vicino)', program:
`// Conta i nodi che raggiungono ogni sorgente. Con xc ogni nodo manda la sua somma
// parziale solo al parent (il vicino più vicino alla sorgente), e 0 a tutti gli altri.
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

  { name: 'Età dei collegamenti (xc)', program:
`// Ogni collegamento conta da quanti round esiste: rimando a ogni vicino quello che mi ha mandato, +1.
// Trascina un nodo altrove: i suoi nuovi collegamenti ripartono da 1.
var program = () => xc(0, (n) => n.map((x) => x + 1)).min();` }
];
