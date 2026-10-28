// Tutorial site chrome: sidebar, prev/next links, and a playground for every .pg-embed.
(function () {
  var STEPS = [
    ['index.html', 'Introduzione'],
    ['01-round.html', '1 · Round e stato'],
    ['02-nbr.html', '2 · Vicini e campi'],
    ['03-gradiente.html', '3 · Il gradiente'],
    ['04-composizione.html', '4 · Comporre funzioni'],
    ['05-branch.html', '5 · Domini e branch'],
    ['06-xc.html', '6 · xc: un messaggio per vicino'],
    ['07-dispositivi.html', '7 · Sui dispositivi reali'],
    ['playground.html', 'Playground']
  ];
  var here = location.pathname.split('/').pop() || 'index.html';
  var cur = STEPS.findIndex(function (s) { return s[0] === here; });

  var toc = document.getElementById('toc');
  if (toc) {
    toc.innerHTML = '<a class="brand" href="index.html">NbrJS</a><ol>' + STEPS.map(function (s, i) {
      return '<li><a href="' + s[0] + '"' + (i === cur ? ' aria-current="page"' : '') + '>' + s[1] + '</a></li>';
    }).join('') + '</ol>';
  }
  var pager = document.getElementById('pager');
  if (pager && cur >= 0) {
    var prev = STEPS[cur - 1], next = STEPS[cur + 1];
    pager.innerHTML = (prev ? '<a href="' + prev[0] + '">← ' + prev[1] + '</a>' : '<span></span>') +
      (next ? '<a href="' + next[0] + '">' + next[1] + ' →</a>' : '');
  }

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
