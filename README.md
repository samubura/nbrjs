# NbrJS

Minimal aggregate computing with **eXchange Calculus (XC)** semantics, in plain JavaScript.
One small core (~5 KB, zero dependencies) that runs on [Espruino](https://www.espruino.com/) (Puck.js, ESP32),
Node and the browser. The same program runs in simulation or on a real BLE network: only the config changes.

```js
require('nbrjs').globals();   // nbr, share, ... as globals: Espruino has no destructuring

var hops = (src) => share(Infinity, (d) => src ? 0 : d.min() + 1);
var program = () => hops(sense('source'));

start(program, {
  target: 'ble',                 // or 'sim' (nodes, layout, range) in Node / the browser
  period: 1000,
  sensors: () => ({ source: BTN.read() }),
  onResult: (h) => LED1.write(h === 0)
});
```

**Learn it:** step-by-step tutorials (Italian) with a live simulator, and a playground, in [`web/`](web/)
(published on GitHub Pages). Locally: `python3 -m http.server` from the repo root, then open `/web/`.

## API

| | |
|---|---|
| `xc(init, n => ...)` | XC primitive. `n`: what each neighbour sent me. Return a field (one message per neighbour) or a value (same to all), or `retsend(ret, send)`. |
| `nbr(v)` | field of the neighbours' `v` |
| `rep(init, x => ...)` | state across rounds (sends nothing) |
| `share(init, n => ...)` | state shared with the neighbours (`xc` returning a local value) |
| `branch(c, () => ..., () => ...)` | splits the domain: the two branches never see each other |
| `align(key, () => ...)` | explicit alignment (loops, dynamic structures) |
| `mid()`, `sense(name)`, `nbrSense(name)` | device id, local sensor, per-neighbour sensor (field) |
| `start(program, config)` | runs it on `config.target`: `'ble'` (`nbrjs/ble`) or `'sim'` (`nbrjs/sim`) |
| `globals()` | the operators above as globals |
| `device(id).round(program, inbox, sensors, nbrSensors)` | one round by hand → `{value, message}` |
| `encode(msg)` / `decode(str)` | JSON that keeps `±Infinity` |

Fields: `.self`, `.map((v, id) => ...)`, `.zip(other, (a, b) => ...)`, `.reduce((acc, v) => ..., init)`, `.min()`, `.max()`, `.sum()`.
Reductions cover the aligned neighbours only (self excluded), so `Math.min`/`Math.max` work as reducers.

Config, common to all targets: `period` (ms), `sensors(id)` → values for `sense()`, `onResult(value, id)`.
`sim`: `nodes`, `layout` (`'random'`, `'grid'`, `'line'`), `range`, `pos`; `sensors(id, x, y, round)`.
`ble`: `ttl` (s before a silent neighbour is dropped); `nbrSense('rssi')` gives signal strength.

## Caveats

- A native `if`/ternary around aggregate operators does **not** align: use `branch`.
- Espruino: no destructuring, spread, default params, Map/Set or function hoisting, in your programs too.
- BLE advertising carries ~23 bytes per message: prefer integers and few operators (the playground shows message sizes).
- ESP-NOW is not exposed by Espruino: ESP32 and Puck.js both talk BLE.

## On a device

- **Playground**: the *Espruino ↗* button gives a file ready for the [Web IDE](https://www.espruino.com/ide/).
- **Web IDE modules**: add `<pages-url>/modules` to *Settings → Communications → Module URL*, then
  `require('nbrjs')` and `require('nbrjs/ble')` work like official modules.
- **CLI**: `npm run bundle -- examples/hops.js > dist/hops.js` inlines the modules (and the target's) for upload.

## Develop

```sh
npm test                 # Node
npm run test:espruino    # same tests on the Espruino interpreter (clones and builds it once into .espruino/)
npm run site             # builds _site/ for GitHub Pages
```

CI (`.github/workflows`) runs both test suites on every push, deploys `web/` to Pages from `main`,
and publishes to npm on `v*` tags (`npm version patch && git push --follow-tags`).

## License

[Apache-2.0](LICENSE). Keep the [NOTICE](NOTICE) (attribution) when redistributing.
