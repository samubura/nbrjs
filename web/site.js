// Site chrome: header, course chapters, footer, code colours, and a playground for every .pg-embed.
(function () {
  var COURSE = [
    ['corso.html', 'Introduzione'],
    ['01-round.html', '1 · Round e stato'],
    ['02-nbr.html', '2 · Vicini e campi'],
    ['03-gradiente.html', '3 · Il gradiente'],
    ['04-composizione.html', '4 · Comporre funzioni'],
    ['05-branch.html', '5 · Domini e branch'],
    ['06-xc.html', '6 · xc: un messaggio per vicino'],
    ['07-dispositivi.html', '7 · Sui dispositivi']
  ];
  var SECTIONS = [['corso.html', 'Corso'], ['playground.html', 'Playground'], ['esp32.html', 'ESP32'], ['puck.html', 'Demo Puck.js']];
  var here = location.pathname.split('/').pop() || 'index.html';
  var cur = COURSE.findIndex(function (s) { return s[0] === here; });
  var section = cur >= 0 ? 'corso.html' : here;

  var header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = '<a class="brand" href="index.html"><img src="logo.svg" alt="">NbrJS</a>' +
    '<button class="icon-btn menu-btn" aria-expanded="false" aria-label="Menu">☰</button><nav>' +
    SECTIONS.map(function (s) {
      return '<a href="' + s[0] + '"' + (s[0] === section ? ' aria-current="page"' : '') + '>' + s[1] + '</a>';
    }).join('') + '<a class="ext" href="https://github.com/samubura/nbrjs">GitHub ↗</a></nav>';
  document.body.prepend(header);
  var menu = header.querySelector('.menu-btn');
  menu.onclick = function () { menu.setAttribute('aria-expanded', header.classList.toggle('open')); };

  var footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = 'NbrJS · Apache-2.0 · <a href="https://github.com/samubura/nbrjs">GitHub</a>';
  document.body.append(footer);

  // Course pages: the chapters on the side (a drawer on phones) and prev/next at the bottom.
  var toc = document.getElementById('toc');
  if (toc) {
    toc.innerHTML = '<h2>Corso</h2><ol>' + COURSE.map(function (s, i) {
      return '<li><a href="' + s[0] + '"' + (i === cur ? ' aria-current="page"' : '') + '>' + s[1] + '</a></li>';
    }).join('') + '</ol>';
    var btn = document.createElement('button'), shade = document.createElement('div');
    btn.className = 'icon-btn toc-btn';
    btn.textContent = '☰ Capitoli';
    shade.className = 'backdrop';
    var close = function () { document.body.classList.remove('toc-open'); };
    btn.onclick = function () { document.body.classList.toggle('toc-open'); };
    shade.onclick = close;
    toc.addEventListener('click', function (e) { if (e.target.tagName === 'A') close(); });
    var main = document.querySelector('main');
    main.prepend(btn);
    document.body.append(shade);
  }
  var pager = document.getElementById('pager');
  if (pager && cur >= 0) {
    var prev = COURSE[cur - 1], next = COURSE[cur + 1];
    pager.innerHTML = (prev ? '<a href="' + prev[0] + '">← ' + prev[1] + '</a>' : '<span></span>') +
      (next ? '<a href="' + next[0] + '">' + next[1] + ' →</a>' : '<a href="playground.html">Playground →</a>');
  }

  // Light syntax colours for the code listings (the editors stay plain textareas).
  var TOK = /(\/\/.*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|\b(var|return|function|if|else|true|false|null|new)\b|\b(xc|retsend|nbr|rep|share|branch|align|id|sense|nbrSense|start|globals)(?=\()|\b(\d+(?:\.\d+)?|Infinity)\b/g;
  var CLS = ['', 'c', 's', 'k', 'op', 'n'];
  var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  document.querySelectorAll('pre > code').forEach(function (el) {
    var src = el.textContent, html = '', last = 0;
    src.replace(TOK, function (m) {
      var a = arguments, at = a[a.length - 2], g = 1;
      while (a[g] === undefined) g++;
      html += esc(src.slice(last, at)) + '<span class="tk-' + CLS[g] + '">' + esc(m) + '</span>';
      last = at + m.length;
      return m;
    });
    el.innerHTML = html + esc(src.slice(last));
  });

  // <script type="text/plain"> holds program.js; an optional <script type="text/plain" data-file="config">
  // shows the config.js tab too. Otherwise the data-* attributes are the simulation config.
  var ints = function (s) { return s ? s.split(',').map(Number) : undefined; };
  document.querySelectorAll('.pg-embed').forEach(function (el) {
    var d = el.dataset, prog = el.querySelector('script:not([data-file])'), conf = el.querySelector('script[data-file=config]');
    Playground.mount(el, {
      program: prog ? prog.textContent.trim() : '',
      tabs: !!conf,
      config: conf ? conf.textContent.trim() : {
        target: 'sim', layout: d.layout, nodes: d.nodes && +d.nodes, range: d.range && +d.range,
        sources: d.sources === '' ? [] : ints(d.sources), obstacles: ints(d.obstacles)
      },
      height: d.height && +d.height, autoplay: d.autoplay !== 'false'
    });
  });
})();
