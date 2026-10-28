<img src="web/logo.svg" width="88" align="right" alt="NbrJS logo">

# NbrJS

[![CI](https://github.com/samubura/nbrjs/actions/workflows/ci.yml/badge.svg)](https://github.com/samubura/nbrjs/actions/workflows/ci.yml)

Aggregate computing in JavaScript, with eXchange Calculus (XC) semantics. One program for the whole network,
running in the browser, in Node, and on [Espruino](https://www.espruino.com/) boards such as Puck.js and ESP32.

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

**[Website](https://samubura.github.io/nbrjs/web/)**: a [course](https://samubura.github.io/nbrjs/web/corso.html) (Italian),
a [playground](https://samubura.github.io/nbrjs/web/playground.html) that also uploads to boards, and an
[ESP32 guide](https://samubura.github.io/nbrjs/web/esp32.html).

## Footprint

- **Code:** ~3 KB minified. When installed in a board's `Storage`, as the playground does, it runs from flash: the core takes about 320 variables, against 475 for the same code uploaded as text (Espruino Linux build).
- **BLE messages:** binary, with 2-byte path hashes. A hop gradient is 3 bytes, a gradient inside a `branch` 6 bytes, and the 23-byte advert fits 5–7 operators.
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
| `id()`, `sense(name)`, `nbrSense(name)` | device id, local sensor, per-neighbour sensor (a field) |
| `start(program, config)` | runs the program on `config.target` |
| `globals()` | puts the operators above in the global scope (Espruino has no destructuring) |

Fields: `.self`, `.map((v, id) => ...)`, `.zip(other, (a, b) => ...)`, `.reduce((acc, v) => ..., init)`, `.min()`, `.max()`, `.sum()`.
Reductions skip the device itself, so `Math.min` and `Math.max` work as reducers.

As in ScaFi, a native `if` or `?:` around aggregate operators does not align them: use `branch`.

## Targets

All targets take `period` (ms), `sensors(id)` (values for `sense()`) and `onResult(value, id)`.

| target | where | options |
|---|---|---|
| `ble` | Puck.js, ESP32 | `ttl` (s). Neighbours are the boards heard recently; `nbrSense('rssi')` gives signal strength |
| `udp` | ESP32, Node | `wifi: {ssid, password}`, `port`, `address`. Broadcast on the LAN: every device on it is a neighbour |
| `sim` | browser, Node | `nodes`, `layout` (`random`, `grid`, `line`), `range`; `nbrSense('range')` is the distance |
| `host` | a board tethered to a PC | the PC runs the rounds and simulates the neighbours ([demo](https://samubura.github.io/nbrjs/web/puck.html)) |

## On a board

- **From the playground** (Chrome or Edge): *Sul dispositivo ↗* installs the library in the board's `Storage` over Bluetooth or USB, then uploads the program, optionally saved to start at boot.
- **From the Espruino Web IDE**: add `https://samubura.github.io/nbrjs/modules` to *Settings → Communications → Module URL*, and `require('nbrjs')` works like any Espruino module.
- **From the command line**: `node scripts/bundle.js app.js > app.bundle.js` inlines the minified modules, ready for the `espruino` CLI.

## Development

```sh
npm ci
npm test                 # Node
npm run test:espruino    # same tests on the Espruino interpreter (builds it once into .espruino/)
npm run site             # the website, into _site/
```

## License

[Apache-2.0](LICENSE). Keep the [NOTICE](NOTICE) when redistributing.
