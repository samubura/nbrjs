// Embeddable NbrJS simulator, organised as a real project in two files:
//   program.js  the aggregate program: the very code that runs on the device
//   config.js   where it runs: target 'sim' here (nodes, layout, sensors), 'ble' on devices
// Playground.mount(el, {program, config: object | code, tabs, presets, height}). Browser only.
(function () {
  var A = nbrjs, S = nbrjsSim;
  var OPS = ['xc', 'retsend', 'nbr', 'rep', 'share', 'branch', 'align', 'id', 'sense', 'nbrSense'];
  // Stand-ins so a whole device file pastes in unchanged: start() hands us the program,
  // the board's pins and setWatch do nothing (inputs are simulated through config.js sensors).
  var PIN = { read: function () { return false; }, write: function () {} };
  var HW = { setWatch: function () {}, BTN: PIN, BTN1: PIN, LED1: PIN, LED2: PIN, LED3: PIN, D0: PIN, D2: PIN };

  var DEFAULT_CONFIG = [
    "// Where program.js runs. On Puck.js / ESP32 the target is 'ble' (see the Espruino button).",
    'return {',
    "  target: 'sim',",
    '  period: 200,',
    "  nodes: 40, layout: 'random', range: 1.5,",
    '  sources: [0], obstacles: [],',
    "  // extra sensors for every node, read with sense('name') in program.js",
    '  sensors: (id, x, y, round) => ({})',
    '};'
  ].join('\n');

  var BLE_START = [
    '',
    '// Same program, real network: only the config changed.',
    'start(program, {',
    "  target: 'ble',",
    '  period: 1000,',
    "  // map the board's inputs to the names program.js reads with sense(), e.g. Puck.js button:",
    '  sensors: () => ({ source: BTN.read() }),',
    '  onResult: (v, id) => console.log(id, v)',
    '});'
  ].join('\n');

  // Runs program.js once, as a device does at boot, and returns its program function.
  var boot = function (code) {
    var started = null;
    var start = function (p) { started = p; return { round: function () {}, stop: function () {} }; };
    var api = Object.assign({}, A, { start: start, globals: function () { return api; } });
    var env = Object.assign({ start: start, require: function () { return api; } }, HW);
    OPS.forEach(function (k) { env[k] = A[k]; });
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

  // Upload-ready file for the Espruino Web IDE: modules inlined as the IDE does, target 'ble'.
  var SRC = (document.querySelector('script[src$="core.js"]') || {}).src || '../src/core.js';
  var exportForEspruino = function (program) {
    var get = function (f) {
      return fetch(new URL(f, SRC)).then(function (r) {
        if (!r.ok) throw new Error(f + ': ' + r.status);
        return r.text();
      }).then(function (t) { return t.replace(/^\s*\/\/.*\n/gm, ''); });
    };
    return Promise.all([get('core.js'), get('ble.js')]).then(function (m) {
      return 'Modules.addCached("nbrjs",' + JSON.stringify(m[0]) + ');\n' +
        'Modules.addCached("nbrjs/ble",' + JSON.stringify(m[1]) + ');\n' +
        (/globals\(\)/.test(program) ? '' : "require('nbrjs').globals();\n") +
        program + (/\bstart\(/.test(program) ? '' : '\n' + BLE_START) + '\n';
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
      '<button data-a="export" title="File ready for the Espruino Web IDE, target ble">Espruino ↗</button>' +
      '<span class="pg-round"></span></div>' +
      '<div class="pg-main"><div class="pg-editors">' +
      '<textarea class="pg-code" data-file="program" spellcheck="false" aria-label="program.js"></textarea>' +
      '<textarea class="pg-code" data-file="config" spellcheck="false" aria-label="config.js" hidden></textarea></div>' +
      '<canvas aria-label="Network"></canvas></div>' +
      '<div class="pg-status" role="status"></div><div class="pg-info"></div>' +
      '<dialog class="pg-export"><p>Paste into the <a href="https://www.espruino.com/ide/" target="_blank" rel="noopener">Espruino Web IDE</a> ' +
      '(right-hand editor), then Upload. Same program, <code>target: \'ble\'</code>.</p>' +
      '<textarea readonly spellcheck="false"></textarea>' +
      '<div class="pg-dialog-bar"><button data-a="copy">Copy</button><button data-a="close">Close</button></div></dialog>';
    var q = function (s) { return el.querySelector(s); };
    var progEl = q('[data-file=program]'), confEl = q('[data-file=config]'), canvas = q('canvas');
    var status = q('.pg-status'), info = q('.pg-info'), roundEl = q('.pg-round');
    var range = q('[data-a=range]'), speed = q('[data-a=speed]'), play = q('[data-a=play]');

    var cfg, pos, sensors, net, program, out = {}, rounds = 0, T = null;
    var playing = o.autoplay !== false, visible = true, hover = null, drag = null;

    var setStatus = function (msg, err) {
      status.textContent = msg || '';
      status.className = 'pg-status' + (err ? ' err' : '');
    };
    var restart = function () {
      net = S.network(pos, +range.value);
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
      range.value = cfg.range || 1.5;
      speed.value = Math.round(1000 / (cfg.period || 200));
      restart();
    };
    var loadProgram = function () {
      try {
        program = boot(progEl.value);
        setStatus('');
        restart();
      } catch (e) {
        setStatus('program.js: ' + e.message, true);
      }
    };
    var loadConfig = function () {
      try {
        cfg = typeof o.config === 'object' && !tabs ? o.config : evalConfig(confEl.value);
        setStatus(cfg.target && cfg.target !== 'sim' ? "config.js: target '" + cfg.target + "' runs on devices; simulating it here" : '');
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
        if (id in out) g.fillText(fmt(out[id]), p[0], p[1] + 23);
      });
      roundEl.textContent = 'round ' + rounds;
      showInfo();
    };
    var showInfo = function () {
      if (hover === null) { info.textContent = 'Click: toggle source · Shift+click: obstacle · Drag: move · Hover: inspect'; return; }
      var m = net.messages[hover] || '', n = 0;
      for (var id in pos) if (id !== hover && Math.hypot(pos[id][0] - pos[hover][0], pos[id][1] - pos[hover][1]) <= net.range) n++;
      info.textContent = 'node ' + hover + ' · value ' + JSON.stringify(out[hover]) + ' · ' + n + ' neighbours · sends ' +
        m.length + ' B: ' + m;
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

    var dialog = q('dialog'), exported = q('dialog textarea');
    q('[data-a=export]').onclick = function () {
      exportForEspruino(progEl.value).then(function (text) {
        exported.value = text;
        dialog.showModal();
      }, function (e) {
        setStatus('export: ' + e.message + ' (serve the site over http, e.g. python3 -m http.server)', true);
      });
    };
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
    return { reset: reset };
  };

  window.Playground = { mount: mount };
})();
