// A real Espruino board as one node of the browser simulation (puck.html), over Web Bluetooth.
// The board runs start(program, {target: 'host'}); each round we send it the inbox from its
// simulated neighbours and read back its value and message. Browser only, Chrome/Edge.
(function () {
  var NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';     // Nordic UART, Espruino's console over BLE
  var RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';      // we write here
  var TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';      // the board notifies here
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // onLine(text): every console line that is not a round answer. onClose(): link lost.
  var connect = async function (onLine, onClose) {
    var dev = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Puck.js' }, { namePrefix: 'Espruino' }, { services: [NUS] }],
      optionalServices: [NUS]
    });
    var gatt = await dev.gatt.connect(), svc = await gatt.getPrimaryService(NUS);
    var rx = await svc.getCharacteristic(RX), tx = await svc.getCharacteristic(TX);
    var buf = '', pending = null, queue = Promise.resolve();

    tx.addEventListener('characteristicvaluechanged', function (e) {
      buf += new TextDecoder().decode(e.target.value);
      var lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach(function (l) {
        l = l.replace(/\r|\x1b\[J|^>/g, '');
        if (l.slice(0, 3) === 'NBR' && pending) { pending(nbrjs.decode(l.slice(3))); pending = null; }
        else if (l.trim()) onLine(l);
      });
    });
    await tx.startNotifications();
    dev.addEventListener('gattserverdisconnected', onClose);

    // BLE writes go out 20 bytes at a time, one after the other.
    var write = function (text) {
      var bytes = new TextEncoder().encode(text);
      queue = queue.then(async function () {
        for (var i = 0; i < bytes.length; i += 20) await rx.writeValue(bytes.slice(i, i + 20));
      });
      return queue;
    };

    var link = {
      name: dev.name,
      close: function () { dev.gatt.disconnect(); },
      // Replaces the board's code, as the Espruino Web IDE does (\x10: no echo for that line).
      upload: async function (code) {
        link.uploading = true;
        try {
          await write('\x03\x10reset();\n');
          await wait(1500);
          await write('\x10' + code.replace(/\n/g, '\n\x10') + '\n');
        } finally { link.uploading = false; }
      },
      // One round on the board: resolves to {id, v, m}, or rejects after 3 s.
      round: function (inbox, nbrSensors) {
        var arg = JSON.stringify(nbrjs.encode({ inbox: inbox, nbr: nbrSensors }));
        return new Promise(function (resolve, reject) {
          pending = resolve;
          write('\x10print(nbrjsRound(' + arg + '))\n');
          setTimeout(function () { if (pending === resolve) { pending = null; reject(new Error('no answer')); } }, 3000);
        });
      },
      // A device for Playground.attach. Rounds over BLE are slower than the simulation: the
      // board answers when it can and its neighbours hear its last message meanwhile.
      device: function (label) {
        var last = { value: undefined, message: {} }, busy = false, d = { id: 'puck', label: label }; // host's default id
        d.round = function (program, inbox, sensors, nbrSensors) {
          if (!busy && !link.uploading) {
            busy = true;
            link.round(inbox, nbrSensors).then(function (r) {
              last = { value: r.v, message: r.m };
            }, function () {}).then(function () { busy = false; });
          }
          return last;
        };
        return d;
      }
    };
    return link;
  };

  window.PuckLink = { connect: connect, supported: !!navigator.bluetooth };
})();
