// Embeddable NbrJS simulator, organised as a real project in two files:
//   program.js  the aggregate program: the very code that runs on the device
//   config.js   where it runs: target 'sim' here (nodes, layout, sensors), 'ble' on devices
// Playground.mount(el, {program, config: object | code, tabs, presets, height}). Browser only.
(function () {
  var A = nbrjs, S = nbrjsSim;
  var OPS = ['xc', 'retsend', 'nbr', 'rep', 'share', 'branch', 'align', 'aggregate', 'id', 'sense', 'nbrSense'];
  // The standard library (src/lib.js), when the page loads it: its blocks are globals too.
  var LIB = window.nbrjsLib || {};
  var usesLib = function (code) {
    return Object.keys(LIB).some(function (k) { return k !== 'globals' && new RegExp('\\b' + k + '\\(').test(code); });
  };
  // Stand-ins so a whole device file pastes in unchanged: start() hands us the program,
  // the board's pins and setWatch do nothing (inputs are simulated through config.js sensors).
  var PIN = { read: function () { return false; }, write: function () {} };
  var HW = { setWatch: function () {}, BTN: PIN, BTN1: PIN, LED1: PIN, LED2: PIN, LED3: PIN, D0: PIN, D2: PIN };

  var DEFAULT_CONFIG = [
    "// The simulated network. For real boards, see 'To device'.",
    'return {',
    "  target: 'sim',",
    '  period: 200,',
    "  nodes: 40, layout: 'random', range: 1.5,",
    '  sources: [0], obstacles: [],',
    "  // as on a real radio: loss: 0.2 loses 20% of the messages, skip: 0.2 misses 20% of the rounds",
    "  // extra sensors for every node, read with sense('name') in program.js",
    '  sensors: (id, x, y, round) => ({})',
    '};'
  ].join('\n');

  // The start() call a device file ends with, per target: only this changes between networks.
  var START = {
    ble: [
      'start(program, {',
      "  target: 'ble',",
      '  period: 1000,',
      "  // the board's inputs, read in program.js with sense(): here the button",
      '  sensors: () => ({ source: BTN1.read() }),',
      '  onResult: (v, id) => LED1.write(v === 0)',
      '});'],
    udp: [
      'start(program, {',
      "  target: 'udp',",
      "  wifi: { ssid: 'SSID', password: 'PASSWORD' },",
      '  period: 1000,',
      '  sensors: () => ({ source: BTN1.read() }),',
      '  onResult: (v, id) => LED1.write(v === 0)',
      '});'],
    host: [
      'var source = false;',
      "setWatch(() => { source = !source; }, BTN1, { edge: 'rising', repeat: true, debounce: 50 });",
      'start(program, {',
      "  target: 'host',",
      "  // the Puck's sensors, read in program.js with sense(name)",
      '  sensors: () => ({ source: source, light: Math.round(Puck.light() * 100) / 100, temp: Math.round(E.getTemperature()) }),',
      '  // LEDs: true green; small numbers 0 red, 1 green, 2 blue',
      '  onResult: (v) => { LED1.write(v === 0); LED2.write(v === 1 || v === true); LED3.write(v === 2); }',
      '});']
  };

  // Warnings about aggregate code under native if / ?: (src/check.js), when the page loads acorn.
  var check = function (code) {
    try { return window.acorn && window.nbrjsCheck ? nbrjsCheck.check(code, acorn) : []; } catch (e) { return []; }
  };
  // Runs program.js once, as a device does at boot, and returns its program function.
  var boot = function (code) {
    var started = null;
    var start = function (p) { started = p; return { round: function () {}, stop: function () {} }; };
    var api = Object.assign({}, A, { start: start, globals: function () { return api; } });
    var lib = Object.assign({}, LIB, { globals: function () { return lib; } });
    var env = Object.assign({ start: start, require: function (m) { return m === 'nbrjs/lib' ? lib : api; } }, HW);
    OPS.forEach(function (k) { env[k] = A[k]; });
    for (var k in LIB) if (k !== 'globals') env[k] = LIB[k];
    var names = Object.keys(env);
    var f = new Function(names.join(','), code + '\n;return typeof program === "function" ? program : undefined;');
    var p;
    try {
      p = f.apply(null, names.map(function (k) { return env[k]; }));
    } catch (e) {
      if (e instanceof TypeError && /null/.test(e.message)) throw new Error(e.message + ' (aggregate operators only work inside program)');
      throw e;
    }
    p = started || p;
    if (typeof p !== 'function') throw new Error('program.js must define var program = () => ...');
    return p;
  };
  var evalConfig = function (code) {
    var c = new Function(code)();
    if (!c || typeof c !== 'object') throw new Error('config.js must return { target: ..., ... }');
    return c;
  };

  // Bytes the message takes in a BLE advert (paths hashed, binary values), as on a Puck.js.
  var bleSize = function (json) {
    var m = A.decode(json), h = {};
    for (var p in m) h[A.hash(p)] = m[p];
    return 1 + nbrjsBle.pack(h).length;
  };
  var fmt = function (v) {
    if (typeof v === 'number') return isFinite(v) ? String(Math.round(v * 10) / 10) : v > 0 ? '∞' : v < 0 ? '-∞' : 'NaN';
    if (v === null || v === undefined) return '–';
    var s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > 9 ? s.slice(0, 8) + '…' : s;
  };
  var hue = function (s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
  };
  // Numbers: warm near 0, cold when far. Booleans: accent/muted. Anything else: a colour per distinct value.
  var colour = function (v, max, accent) {
    if (typeof v === 'number') return isFinite(v) ? 'hsl(' + (15 + 210 * Math.min(Math.abs(v) / max, 1)) + ',75%,55%)' : null;
    if (typeof v === 'boolean') return v ? accent : null;
    if (v === null || v === undefined) return null;
    return 'hsl(' + hue(JSON.stringify(v)) + ',65%,55%)';
  };

  // program.js as a device file: the library comes from the board's Storage (or the IDE's
  // module URL), so the file is just the program plus start().
  var deviceFile = function (program, target, wifi) {
    var st = START[target || 'ble'].join('\n');
    if (wifi) st = st.replace("'SSID'", JSON.stringify(wifi.ssid)).replace("'PASSWORD'", JSON.stringify(wifi.password));
    var head = /globals\(\)/.test(program) ? '' : "require('nbrjs').globals();\n" +
      (usesLib(program) ? "require('nbrjs/lib').globals();\n" : '');
    return head + program.trim() +
      (/\bstart\(/.test(program) ? '' : '\n\n' + st) + '\n';
  };
  var SRC = (document.querySelector('script[src$="core.js"]') || {}).src || new URL('../src/core.js', location.href).href;
  var HERE = document.currentScript && document.currentScript.src;
  var loadDevice = function () {
    return window.Device ? Promise.resolve() : new Promise(function (ok, ko) {
      var sc = document.createElement('script');
      sc.src = new URL('device.js', HERE || location.href);
      sc.onload = ok; sc.onerror = function () { ko(new Error('device.js not found')); };
      document.head.appendChild(sc);
    });
  };

  var mount = function (el, o) {
    o = o || {};
    var tabs = !!o.tabs;
    el.classList.add('pg');
    el.innerHTML =
      '<div class="pg-bar">' +
      (o.presets ? '<select class="pg-presets" aria-label="Examples"></select>' : '') +
      (tabs ? '<span class="pg-tabs" role="tablist"><button role="tab" data-tab="program" aria-selected="true">program.js</button>' +
        '<button role="tab" data-tab="config" aria-selected="false">config.js</button></span>' : '') +
      '<button data-a="play" title="Play / pause">⏸</button>' +
      '<button data-a="step" title="One round">Step</button>' +
      '<button data-a="reset" title="Reset network and state">Reset</button>' +
      '<label>range <input data-a="range" type="range" min="0.8" max="3" step="0.1"></label>' +
      '<label>speed <input data-a="speed" type="range" min="1" max="30" step="1"></label>' +
      '<button data-a="export" title="Run program.js on a Puck.js or ESP32">To device ↗</button>' +
      '<span class="pg-round"></span></div>' +
      '<div class="pg-main"><div class="pg-editors">' +
      '<textarea class="pg-code" data-file="program" spellcheck="false" aria-label="program.js"></textarea>' +
      '<textarea class="pg-code" data-file="config" spellcheck="false" aria-label="config.js" hidden></textarea></div>' +
      '<canvas aria-label="Network"></canvas></div>' +
      '<div class="pg-status" role="status"></div><div class="pg-info"></div>' +
      '<dialog class="pg-export"><h3>To device</h3>' +
      '<p>The same <b>program.js</b>, on a real network. The first time, the library is installed on the board too.</p>' +
      '<div class="pg-form"><label>Network <select data-d="target"><option value="ble">Bluetooth: Puck.js, ESP32</option>' +
      '<option value="udp">WiFi: ESP32</option></select></label>' +
      '<label data-d="wifi" hidden>WiFi <input data-d="ssid" placeholder="network name" autocomplete="off"> ' +
      '<input data-d="pass" type="password" placeholder="password" autocomplete="off"></label>' +
      '<label><input type="checkbox" data-d="save"> Save: start by itself at power-up</label></div>' +
      '<div class="pg-dialog-bar"><span class="pg-dev-status" role="status"></span>' +
      '<button data-a="up-ble">Upload via Bluetooth</button><button data-a="up-usb">Upload via USB</button></div>' +
      '<pre class="pg-dev-log" hidden></pre>' +
      '<details><summary>With the Espruino Web IDE</summary><p>In <i>Settings → Communications → Module URL</i> add ' +
      '<code class="pg-modurl"></code>, then paste this file in the editor and press Upload.</p>' +
      '<textarea readonly spellcheck="false"></textarea>' +
      '<div class="pg-dialog-bar"><button data-a="copy">Copy</button></div></details>' +
      '<div class="pg-dialog-bar"><button data-a="close">Close</button></div></dialog>';
    var q = function (s) { return el.querySelector(s); };
    var progEl = q('[data-file=program]'), confEl = q('[data-file=config]'), canvas = q('canvas');
    var status = q('.pg-status'), info = q('.pg-info'), roundEl = q('.pg-round');
    var range = q('[data-a=range]'), speed = q('[data-a=speed]'), play = q('[data-a=play]');

    var cfg, pos, sensors, net, program, out = {}, rounds = 0, T = null, remote = null;
    var playing = o.autoplay !== false, visible = true, hover = null, drag = null;

    var overBle = function () { return !!cfg && cfg.target === 'ble' && !!window.nbrjsBle; };
    var setStatus = function (msg, err) {
      status.textContent = msg || '';
      status.className = 'pg-status' + (err ? ' err' : '');
    };
    var restart = function () {
      // target 'ble': messages in the BLE format, so float32, hashed paths and the 23-byte limit show here.
      net = S.network(pos, +range.value, { codec: overBle() ? nbrjsBle.sim : null, loss: cfg.loss, skip: cfg.skip, ttl: cfg.ttl });
      if (remote) net.devices[remote.id] = remote;
      out = {};
      rounds = 0;
      draw();
    };
    // New network from the config: positions, initial sources/obstacles, range and speed.
    var reset = function () {
      pos = S.layout(cfg.layout || 'random', cfg.nodes || 30, cfg.seed);
      canvas.style.height = (o.height || (cfg.layout === 'line' ? 120 : 340)) + 'px';
      sensors = {};
      for (var id in pos) sensors[id] = { source: false, obstacle: false };
      (cfg.sources || [0]).forEach(function (id) { if (sensors[id]) sensors[id].source = true; });
      (cfg.obstacles || []).forEach(function (id) { if (sensors[id]) sensors[id].obstacle = true; });
      place();
      range.value = cfg.range || 1.5;
      speed.value = Math.round(1000 / (cfg.period || 200));
      restart();
    };
    // A node played by something else, e.g. a real board (puck.html): dev = {id, label, round(program, inbox, sensors, nbrSensors)}.
    // It joins between the central nodes; attach(null) removes it.
    var place = function () {
      if (!remote) return;
      var ids = Object.keys(pos), x = 0, y = 0;
      ids.forEach(function (id) { x += pos[id][0] / ids.length; y += pos[id][1] / ids.length; });
      pos[remote.id] = pos[remote.id] || [x + 0.5, y + 0.5];
      sensors[remote.id] = sensors[remote.id] || { source: false, obstacle: false };
    };
    var attach = function (dev) {
      if (remote) { delete pos[remote.id]; delete sensors[remote.id]; delete out[remote.id]; }
      remote = dev;
      place();
      restart();
    };
    var loadProgram = function () {
      try {
        program = boot(progEl.value);
        setStatus(check(progEl.value).join(' · '));
        restart();
      } catch (e) {
        setStatus('program.js: ' + e.message, true);
      }
    };
    var loadConfig = function () {
      try {
        cfg = typeof o.config === 'object' && !tabs ? o.config : evalConfig(confEl.value);
        setStatus(overBle() ? "config.js: target 'ble', simulated with Bluetooth messages (binary, 23 bytes at most)" :
          cfg.target && cfg.target !== 'sim' ? "config.js: target '" + cfg.target + "' runs on devices; simulating it here" : '');
        reset();
      } catch (e) {
        setStatus('config.js: ' + e.message, true);
      }
    };
    var tick = function () {
      if (!program) return;
      for (var id in pos) {
        var extra = cfg.sensors ? cfg.sensors(id, pos[id][0], pos[id][1], rounds) : {};
        sensors[id] = Object.assign(extra, { x: pos[id][0], y: pos[id][1], source: sensors[id].source, obstacle: sensors[id].obstacle });
      }
      try {
        out = net.step(program, sensors);
        rounds++;
      } catch (e) {
        setStatus('round ' + (rounds + 1) + ': ' + e.message, true);
        setPlaying(false);
      }
      draw();
    };
    var loop = function () {
      if (playing && visible) tick();
      setTimeout(loop, 1000 / speed.value);
    };
    var setPlaying = function (p) {
      playing = p;
      play.textContent = p ? '⏸' : '▶';
    };

    var view = function (w, h) {
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, pad = 22;
      for (var id in pos) {
        x0 = Math.min(x0, pos[id][0]); x1 = Math.max(x1, pos[id][0]);
        y0 = Math.min(y0, pos[id][1]); y1 = Math.max(y1, pos[id][1]);
      }
      var s = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad - 14) / (y1 - y0 || 1));
      return { s: s, ox: (w - (x1 - x0) * s) / 2 - x0 * s, oy: (h - 14 - (y1 - y0) * s) / 2 - y0 * s };
    };
    var screen = function (id) { return [T.ox + pos[id][0] * T.s, T.oy + pos[id][1] * T.s]; };

    var draw = function () {
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !pos) return;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      var g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      if (!drag) T = view(w, h);
      var css = getComputedStyle(el), v = function (n) { return css.getPropertyValue(n).trim(); };
      var fg = v('--fg'), muted = v('--node-off'), edge = v('--edge'), accent = v('--accent');
      var ids = Object.keys(pos), max = 1, i, j;
      for (i in out) if (typeof out[i] === 'number' && isFinite(out[i])) max = Math.max(max, Math.abs(out[i]));

      g.strokeStyle = edge;
      g.lineWidth = 1;
      for (i = 0; i < ids.length; i++) for (j = i + 1; j < ids.length; j++) {
        var a = pos[ids[i]], b = pos[ids[j]];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) > net.range) continue;
        var p = screen(ids[i]), r = screen(ids[j]);
        g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(r[0], r[1]); g.stroke();
      }
      g.font = '11px ui-monospace, monospace';
      g.textAlign = 'center';
      ids.forEach(function (id) {
        var p = screen(id), s = sensors[id];
        g.beginPath();
        g.arc(p[0], p[1], 8, 0, 2 * Math.PI);
        g.fillStyle = s.obstacle ? fg : colour(out[id], max, accent) || muted;
        g.fill();
        if (s.source || id === hover) {
          g.lineWidth = s.source ? 3 : 1.5;
          g.strokeStyle = s.source ? accent : fg;
          g.beginPath(); g.arc(p[0], p[1], 12, 0, 2 * Math.PI); g.stroke();
        }
        g.fillStyle = fg;
        if (id in out && out[id] !== false) g.fillText(fmt(out[id]), p[0], p[1] + 23); // false: the muted colour says it
        if (remote && id === remote.id) {
          g.fillStyle = accent;
          g.fillText(remote.label || id, p[0], p[1] - 16);
        }
      });
      roundEl.textContent = 'round ' + rounds;
      showInfo();
    };
    var showInfo = function () {
      if (hover === null) { info.textContent = 'Click: source · Shift+click: obstacle · Drag: move · Hover: inspect'; return; }
      var m = net.messages[hover] || '', n = 0;
      for (var id in pos) if (id !== hover && Math.hypot(pos[id][0] - pos[hover][0], pos[id][1] - pos[hover][1]) <= net.range) n++;
      var sends = !overBle() ? m + (m && window.nbrjsBle ? ' · over BLE ' + bleSize(m) + ' B' : '') :
        hover in net.messages ? (m ? A.encode(nbrjsBle.sim.decode(m)) + ' · ' + (m.length + 1) + ' B' : 'nothing: over 23 bytes') : '';
      info.textContent = 'node ' + hover + ' · value ' + JSON.stringify(out[hover]) + ' · ' + n + ' neighbours · sends ' + sends;
    };

    var pick = function (e) {
      var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 196;
      for (var id in pos) {
        var p = screen(id), d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
        if (d < bd) { bd = d; best = id; }
      }
      return { id: best, x: x, y: y };
    };
    canvas.addEventListener('pointerdown', function (e) {
      var p = pick(e);
      if (p.id === null) return;
      drag = { id: p.id, x: p.x, y: p.y, moved: false };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = pick(e);
      if (drag) {
        if (Math.abs(p.x - drag.x) + Math.abs(p.y - drag.y) > 4) drag.moved = true;
        if (drag.moved) pos[drag.id] = [(p.x - T.ox) / T.s, (p.y - T.oy) / T.s];
        hover = drag.id;
      } else hover = p.id;
      draw();
    });
    canvas.addEventListener('pointerup', function (e) {
      if (drag && !drag.moved) {
        var s = sensors[drag.id];
        if (e.shiftKey) s.obstacle = !s.obstacle; else s.source = !s.source;
      }
      drag = null;
      draw();
    });
    canvas.addEventListener('pointerleave', function () { if (!drag) { hover = null; draw(); } });

    play.onclick = function () { setPlaying(!playing); };
    q('[data-a=step]').onclick = function () { setPlaying(false); tick(); };
    q('[data-a=reset]').onclick = reset;
    range.oninput = function () { net.range = +range.value; draw(); };

    // Device dialog: upload over Bluetooth or USB, or a file for the Espruino IDE.
    var dialog = q('dialog'), exported = q('dialog textarea'), d = function (n) { return q('[data-d=' + n + ']'); };
    var devStatus = q('.pg-dev-status'), devLog = q('.pg-dev-log');
    var file = function () {
      var t = d('target').value;
      return deviceFile(progEl.value, t, t === 'udp' && d('ssid').value ? { ssid: d('ssid').value, password: d('pass').value } : null);
    };
    var refresh = function () { d('wifi').hidden = d('target').value !== 'udp'; exported.value = file(); };
    d('target').onchange = refresh;
    d('ssid').oninput = d('pass').oninput = refresh;
    q('.pg-modurl').textContent = new URL('../modules', SRC).href;
    q('[data-a=export]').onclick = function () {
      refresh();
      q('[data-a=up-ble]').disabled = !navigator.bluetooth;
      q('[data-a=up-usb]').disabled = !navigator.serial;
      if (!navigator.bluetooth && !navigator.serial) devStatus.textContent = 'Needs Chrome or Edge (Web Bluetooth / Web Serial)';
      dialog.showModal();
    };
    ['ble', 'usb'].forEach(function (kind) {
      q('[data-a=up-' + kind + ']').onclick = function () {
        var lines = [], link;
        var say = function (t) { devStatus.textContent = t; };
        devLog.hidden = true;
        loadDevice().then(function () {
          return Device.connect(kind, function (l) { lines.push(l); }, function () {});
        }).then(function (l) {
          link = l;
          return link.upload(file(), d('save').checked, say);
        }).then(function () {
          say('running on ' + link.name);
          // A connected Puck does not advertise: let go, after a moment to catch errors.
          setTimeout(function () {
            link.close();
            if (lines.length) { devLog.textContent = lines.slice(-12).join('\n'); devLog.hidden = false; }
          }, 2000);
        }, function (e) {
          say(e.name === 'NotFoundError' ? '' : 'error: ' + e.message);
          if (link) link.close();
        });
      };
    });
    q('[data-a=copy]').onclick = function () { navigator.clipboard.writeText(exported.value); };
    q('[data-a=close]').onclick = function () { dialog.close(); };

    el.querySelectorAll('[data-tab]').forEach(function (b) {
      b.onclick = function () {
        el.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
        progEl.hidden = b.dataset.tab !== 'program';
        confEl.hidden = b.dataset.tab !== 'config';
      };
    });

    var fit = function (t) { t.rows = Math.max(3, t.value.split('\n').length + 1); };
    var debounce;
    [[progEl, loadProgram], [confEl, loadConfig]].forEach(function (pair) {
      pair[0].addEventListener('input', function () {
        fit(pair[0]);
        clearTimeout(debounce);
        debounce = setTimeout(pair[1], 300);
      });
      pair[0].addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        pair[0].setRangeText('  ', pair[0].selectionStart, pair[0].selectionEnd, 'end');
      });
    });

    var show = function (programCode, configCode) {
      progEl.value = programCode;
      confEl.value = configCode || DEFAULT_CONFIG;
      fit(progEl); fit(confEl);
      loadConfig();
      loadProgram();
    };
    if (o.presets) {
      var sel = q('.pg-presets');
      o.presets.forEach(function (p, i) { sel.add(new Option(p.name, i)); });
      sel.onchange = function () { show(o.presets[sel.value].program, o.presets[sel.value].config); };
      if (!o.program) { o.program = o.presets[0].program; o.config = o.presets[0].config; }
    }
    show(o.program || 'var program = () => id();', typeof o.config === 'string' ? o.config : null);
    setPlaying(playing);
    // Pause the simulation when scrolled out of view (tutorial pages have many).
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(el);
    }
    window.addEventListener('resize', draw);
    loop();
    return { reset: reset, attach: attach, program: function () { return progEl.value; } };
  };

  window.Playground = { mount: mount, deviceFile: deviceFile, check: check };
})();
