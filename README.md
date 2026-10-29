<img src="web/logo.svg" width="88" align="right" alt="NbrJS logo">

# NbrJS

[![CI](https://github.com/samubura/nbrjs/actions/workflows/ci.yml/badge.svg)](https://github.com/samubura/nbrjs/actions/workflows/ci.yml)

Aggregate computing in JavaScript, with eXchange Calculus (XC) semantics. One program for the whole network,
running in the browser, in Node, and on [Espruino](https://www.espruino.com/) boards: swarms of Puck.js, or ESP32 robots
talking over Bluetooth or WiFi.

```js
require('nbrjs').globals();

var hops = (src) => share(Infinity, (d) => src ? 0 : d.min() + 1);
var program = () => hops(sense('source'));

start(program, {
  target: 'ble',                 // 'udp' (WiFi), 'sim', 'host'
  period: 1000,
  sensors: () => ({ source: BTN1.read() }),
  onResult: (h) => LED1.write(h === 0)
});
```

**[Website](https://samubura.github.io/nbrjs/web/)**: a [course](https://samubura.github.io/nbrjs/web/course.html),
a [playground](https://samubura.github.io/nbrjs/web/playground.html) that also uploads to boards, and an
[ESP32 guide](https://samubura.github.io/nbrjs/web/esp32.html).

## Footprint

- **Code:** the core is ~4 KB minified. When installed in a board's `Storage`, as the playground does, it runs from flash: about 380 variables, against 510 for the same code uploaded as text. The library adds about 270 (350 as text), the BLE transport 130 (260). Measured on the Espruino Linux build.
- **BLE messages:** binary, with 2-byte path hashes. A hop gradient is 3 bytes, a gradient inside a `branch` 6 bytes, and a 23-byte advert fits 5–7 operators. Bigger messages go in up to 4 adverts sent in turn (`chunks`), each with whole operators.
- **Objects:** `share({dist: Infinity, value: v}, ...)` sends `[dist, value]`, without field names. Every device runs the same program, so the receiver rebuilds the object from the operator's initial value, which also fixes its shape.
- **Tests:** the suite runs on the Espruino interpreter in CI, on the minified bundle that ships to devices.

## API

| | |
|---|---|
| `xc(init, n => ...)` | XC primitive. `n`: what each neighbour sent me. Return a field (one value per neighbour), a value (the same for all), or `retsend(ret, send)` |
| `nbr(v)` | field of the neighbours' `v` |
| `rep(init, x => ...)` | local state across rounds |
| `share(init, n => ...)` | state shared with the neighbours |
| `branch(c, () => a, () => b)` | splits the network: the two sides do not see each other (`b` is optional) |
| `align(key, () => ...)` | explicit alignment, for loops and dynamic structures |
| `aggregate(name, fn)` | aligns calls by function: different functions never share messages |
| `id()`, `sense(name)`, `nbrSense(name)` | device id, local sensor, per-neighbour sensor (a field) |
| `start(program, config)` | runs the program on `config.target` |
| `globals()` | puts the operators above in the global scope (Espruino has no destructuring) |

Fields: `.self`, `.map((v, id) => ...)`, `.zip(other, (a, b) => ...)`, `.reduce((acc, v) => ..., init)`, `.min()`, `.max()`, `.sum()`.
Reductions skip the device itself, so `Math.min` and `Math.max` work as reducers.

**Control flow.** Aggregate code under `if`, `?:`, `&&` or `||` needs `branch`: a plain `if` does not align.
The playground and `scripts/bundle.js` warn where one is missing ([`src/check.js`](src/check.js), needs `acorn`),
but never rewrite your code, so it behaves the same from the Espruino IDE.

**Standard library** (`require('nbrjs/lib').globals()`, opt-in): `hopsTo(source, max)`, `distanceTo(source, metric, max)`,
`broadcast(source, value)`, `collect(distance, value, accumulate, none)`, `collectSum(distance, value)`, `isLeader(radius)`,
`networkMax(v)`, `networkMin(v)`, `neighbourCount()`, `rounds()`, `countdown(n)`, `minId(field)`. With `max`, a gradient
stops climbing when its source goes away. All of it, with the options of each target: [Reference](https://samubura.github.io/nbrjs/web/reference.html).

## Targets

All targets take `period` (ms), `sensors(id)` (values for `sense()`) and `onResult(value, id)`. On `ble` and `udp`,
`group: 'name'` makes devices hear only those with the same group, at no cost in bytes.

| target | where | options |
|---|---|---|
| `ble` | Puck.js, ESP32 | `ttl` (s), `scan` (ms of listening per period, 400), `minRssi`, `txPower`, `chunks` (adverts a big message may take, 4). No infrastructure; `id()` is a number (the last 2 bytes of the address), `nbrSense('rssi')`, and `nbrSense('range')` estimated in metres. In the playground, `target: 'ble'` simulates with the same binary messages (`sim.network(pos, range, {codec: sim.bleCodec()})`) |
| `udp` | ESP32, Node | `wifi: {ssid, password}`, `position: () => [x, y]`, `range`, `port`, `address`. Broadcast over WiFi; with positions, neighbours are those within `range` |
| `sim` | browser, Node | `nodes`, `layout` (`random`, `grid`, `line`), `range`; `nbrSense('range')` is the distance. As on a radio: `loss` (share of messages lost), `skip` (share of rounds missed), `ttl` (rounds a silent neighbour is kept) |
| `host` | a board tethered to a PC | the PC runs the rounds and simulates the neighbours ([demo](https://samubura.github.io/nbrjs/web/puck.html)) |

## On a board

- **From the playground** (Chrome or Edge): *To device ↗* installs the library in the board's `Storage` over Bluetooth or USB, then uploads the program, optionally saved to start at boot.
- **From the Espruino Web IDE**: add `https://samubura.github.io/nbrjs/modules` to *Settings → Communications → Module URL*, and `require('nbrjs')` works like any Espruino module.
- **From the command line**: `npx nbrjs bundle app.js > app.bundle.js` (or `node scripts/bundle.js` in a clone) inlines the modules, ready for the `espruino` CLI or the IDE. With `terser` and `acorn` installed next to it, the modules are minified and the program is checked for missing `branch`es.

Editors get types from `types/` (TypeScript declarations); for the globals, `/// <reference types="nbrjs/types/globals" />`.

## Development

```sh
npm ci
npm test                 # Node
npm run test:espruino    # same tests on the Espruino interpreter (builds it once into .espruino/)
npm run site             # the website, into _site/
```

## License

[Apache-2.0](LICENSE). Keep the [NOTICE](NOTICE) when redistributing.
