// Hop-count gradient on Puck.js or ESP32 (Espruino), over BLE.
// Press the button to toggle the source; LEDs show the hops: 0 red, 1 green, 2 blue, more off.
// Bundle and upload: npm run bundle -- examples/hops.js > dist/hops.js
require('nbrjs').globals();

// The aggregate program: identical in the simulator and on the devices.
var hops = (src) => share(Infinity, (d) => src ? 0 : d.min() + 1);
var program = () => hops(sense('source'));

// Puck.js pins. ESP32 dev boards: e.g. BUTTON = D0 (BOOT), LEDS = [D2].
var BUTTON = BTN, LEDS = [LED1, LED2, LED3];
var source = false;
setWatch(() => { source = !source; }, BUTTON, { edge: 'rising', repeat: true, debounce: 50 });

// Only the config knows where the program runs: target 'ble' here, 'sim' in the simulator.
start(program, {
  target: 'ble',
  period: 1000,
  sensors: () => ({ source: source }),
  onResult: (h, id) => {
    LEDS.forEach((l, i) => l.write(i === h));
    console.log(id + ' hops=' + h);
  }
});
