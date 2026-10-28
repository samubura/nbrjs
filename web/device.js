// Talks to an Espruino board from the browser, over Bluetooth (Web Bluetooth, Nordic UART)
// or USB (Web Serial). Installs the library in the board's Storage, where it runs from flash
// and costs little RAM, then uploads just the program. Also plays a board as one node of the
// simulation (target 'host', puck.html). Browser only: Chrome/Edge, https or localhost.
(function () {
  var NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';     // Nordic UART: Espruino's console over BLE
  var RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';      // we write here
  var TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';      // the board notifies here
  var FILES = { 'nbrjs': 'core.js', 'nbrjs/ble': 'ble.js', 'nbrjs/udp': 'udp.js', 'nbrjs/host': 'host.js' };
  var SRC = (document.querySelector('script[src$="core.js"]') || {}).src || new URL('../src/core.js', location).href;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // Minified modules from the site build (modules/), else the sources without comments.
  var get = function (u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + ': ' + r.status); return r.text(); });
  };
  var module = function (id) {
    return get(new URL('../modules/' + id + '.js', SRC)).catch(function () {
      return get(new URL(FILES[id], SRC)).then(function (t) { return t.replace(/^\s*\/\/.*\n/gm, ''); });
    });
  };
  // The modules a device file needs: the core, what it requires and its start() target.
  var needs = function (code) {
    var ids = ['nbrjs'];
    code.replace(/require\(['"](nbrjs\/\w+)['"]\)|target:\s*['"](\w+)['"]/g, function (_, req, t) {
      var id = req || 'nbrjs/' + t;
      if (FILES[id] && ids.indexOf(id) < 0) ids.push(id);
    });
    return ids;
  };
  // Storage sizes are in bytes: keep the text ASCII (\u escapes are valid in strings and regexps).
  var ascii = function (s) {
    return s.replace(/[^\x00-\x7f]/g, function (c) { return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4); });
  };

  var ble = async function () {
    var dev = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Puck.js' }, { namePrefix: 'Espruino' }, { namePrefix: 'ESP32' }, { services: [NUS] }],
      optionalServices: [NUS]
    });
    var svc = await (await dev.gatt.connect()).getPrimaryService(NUS);
    var rx = await svc.getCharacteristic(RX), tx = await svc.getCharacteristic(TX);
    var t = { name: dev.name || 'Bluetooth' };
    tx.addEventListener('characteristicvaluechanged', function (e) {
      var v = e.target.value;
      t.data(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    });
    await tx.startNotifications();
    dev.addEventListener('gattserverdisconnected', function () { t.closed(); });
    t.send = async function (bytes) { for (var i = 0; i < bytes.length; i += 20) await rx.writeValue(bytes.slice(i, i + 20)); };
    t.close = function () { dev.gatt.disconnect(); };
    return t;
  };
  var usb = async function () {
    var port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    var w = port.writable.getWriter(), r = port.readable.getReader();
    var t = { name: 'USB' };
    (async function () {
      try { for (;;) { var c = await r.read(); if (c.done) break; t.data(c.value); } } catch (e) { /* unplugged */ }
      t.closed();
    })();
    // ponytail: small chunks, no flow control; enough for Espruino's console at 115200 baud.
    t.send = async function (bytes) { for (var i = 0; i < bytes.length; i += 64) { await w.write(bytes.slice(i, i + 64)); await wait(5); } };
    t.close = function () { r.cancel().then(function () { w.releaseLock(); r.releaseLock(); return port.close(); }); };
    return t;
  };

  // kind: 'ble', 'usb', or a transport {name, send(bytes), close()} whose data(bytes)/closed()
  // we set. onLine(text): console output. onClose(): link lost.
  var connect = async function (kind, onLine, onClose) {
    var t = typeof kind === 'object' ? kind : await (kind === 'usb' ? usb : ble)();
    var dec = new TextDecoder(), enc = new TextEncoder(), buf = '', waiting = [], queue = Promise.resolve();
    t.data = function (bytes) {
      buf += dec.decode(bytes, { stream: true });
      var lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach(function (l) {
        l = l.replace(/\r|\x1b\[J|^>+/g, '');
        var w = waiting.find(function (x) { return l.slice(0, x.prefix.length) === x.prefix; });
        if (w) { waiting.splice(waiting.indexOf(w), 1); w.resolve(l.slice(w.prefix.length)); }
        else if (l.trim()) onLine(l);
      });
    };
    t.closed = onClose;
    var write = function (text) {
      var bytes = enc.encode(text);
      queue = queue.then(function () { return t.send(bytes); });
      return queue;
    };
    // The next console line starting with prefix (rejects after ms).
    var expect = function (prefix, ms) {
      return new Promise(function (resolve, reject) {
        var w = { prefix: prefix, resolve: resolve };
        waiting.push(w);
        setTimeout(function () {
          var i = waiting.indexOf(w);
          if (i >= 0) { waiting.splice(i, 1); reject(new Error('the board did not answer')); }
        }, ms);
      });
    };
    // Runs one line of JS without echo (\x10) and waits until the board has done it.
    var run = function (js, ms) {
      var done = expect('NBRok', ms || 5000);
      write('\x10' + js + ';print("NBRok")\n');
      return done;
    };
    // Chunks keep the console lines short; the first write sets the file size.
    var store = async function (name, data) {
      for (var i = 0; i < data.length || i === 0; i += 512) {
        var args = JSON.stringify(name) + ',' + JSON.stringify(data.slice(i, i + 512)) + ',' + i + (i ? '' : ',' + data.length);
        await run('require("Storage").write(' + args + ')');
      }
    };

    var link = {
      name: t.name,
      close: t.close,
      // Installs the modules the code needs, then runs it: in RAM, or saved to start at boot.
      // progress(text) reports each step.
      upload: async function (code, save, progress) {
        progress = progress || function () {};
        link.uploading = true;
        try {
          await write('\x03');
          await run('reset()', 8000);
          await wait(300);
          var ids = needs(code);
          for (var i = 0; i < ids.length; i++) {
            progress('installo ' + ids[i]);
            await store(ids[i], ascii(await module(ids[i])));
          }
          progress(save ? 'salvo il programma' : 'avvio il programma');
          if (save) {
            await store('.bootcde', ascii(code));
            await write('\x10load()\n');
          } else {
            await write('\x10' + code.replace(/\n/g, '\n\x10') + '\n');
          }
        } finally { link.uploading = false; }
      },
      // One round on a board running target 'host': resolves to {id, v, m}.
      round: function (inbox, nbrSensors) {
        var arg = JSON.stringify(nbrjs.encode({ inbox: inbox, nbr: nbrSensors }));
        var answer = expect('NBR{', 3000);
        write('\x10print(nbrjsRound(' + arg + '))\n');
        return answer.then(function (json) { return nbrjs.decode('{' + json); });
      },
      // A node for Playground.attach. Rounds over the link are slower than the simulation:
      // the board answers when it can, and its neighbours hear its last message meanwhile.
      device: function (label) {
        var last = { value: undefined, message: {} }, busy = false, d = { id: 'puck', label: label }; // host's default id
        d.round = function (program, inbox, sensors, nbrSensors) {
          if (!busy && !link.uploading) {
            busy = true;
            link.round(inbox, nbrSensors).then(function (r) { last = { value: r.v, message: r.m }; }, function () {})
              .then(function () { busy = false; });
          }
          return last;
        };
        return d;
      }
    };
    return link;
  };

  window.Device = {
    connect: connect,
    module: module,
    bluetooth: !!navigator.bluetooth,
    usb: !!navigator.serial
  };
})();
