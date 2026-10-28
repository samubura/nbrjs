# NbrJS

Minimal aggregate computing core with **eXchange Calculus (XC)** semantics, in plain JavaScript.
One file, zero dependencies; runs on [Espruino](https://www.espruino.com/), Node and the browser.

```js
var A = require('nbrjs');
var share = A.share, nbrSense = A.nbrSense, mid = A.mid;

var gradient = (src) =>
  share(Infinity, (d) => src ? 0 :
    d.zip(nbrSense('range'), (a, b) => a + b).reduce(Math.min, Infinity));

var dev = A.device(42);
var out = dev.round(() => gradient(mid() === 0), inbox, sensors, { range: { 7: 1.2 } });
// out.value: result, out.message: broadcast it (A.encode / A.decode for the wire)
```

## API

| | |
|---|---|
| `xc(init, n => ...)` | XC primitive. Return a value/field (both result and message) or `retsend(ret, send)`. |
| `nbr(v)` | field of neighbours' `v` |
| `rep(init, x => ...)` | state across rounds (sends nothing) |
| `share(init, n => ...)` | like `xc` returning a local value |
| `branch(c, () => ..., () => ...)` | domain partition |
| `align(key, () => ...)` | explicit alignment (loops, dynamic structures) |
| `mid()`, `sense(name)`, `nbrSense(name)` | device id, local sensor, per-neighbour sensor (field) |
| `device(id).round(program, inbox, sensors, nbrSensors)` | one round → `{value, message}` |
| `encode(msg)` / `decode(str)` | JSON that keeps `Infinity`/`NaN` |

Fields: `.self`, `.map((v, id) => ...)`, `.zip(other, (a, b) => ...)`, `.reduce((acc, v) => ..., init)`
(neighbours only, self excluded, so `Math.min`/`Math.max` work as reducers).

## Caveats

- A native `if` around aggregate operations does **not** align: use `branch`.
- Espruino has no destructuring, spread, default params, Map/Set or function hoisting. That applies to your programs too:
  import with `var nbr = A.nbr`, define functions before using them.
- The core does no networking: the platform delivers `inbox = {neighbourId: message}` and drops stale neighbours.

## Develop

```sh
npm test                 # Node
npm run test:espruino    # same tests on the Espruino interpreter (builds it once into .espruino/)
```

Demo: open `examples/gradient.html` in a browser (click a node to move the source).
