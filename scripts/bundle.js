// Inlines the nbrjs modules an app requires, as the Espruino Web IDE does with Modules.addCached.
// Usage: node scripts/bundle.js app.js > app.bundle.js   (then upload with the Web IDE or `espruino` CLI)
//        node scripts/bundle.js --modules out/          (just the minified modules, one file each)
// Modules are minified with terser when it is installed: Espruino keeps function source in RAM.
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var mods = { 'nbrjs': 'src/core.js', 'nbrjs/sim': 'src/sim.js', 'nbrjs/ble': 'src/ble.js',
  'nbrjs/host': 'src/host.js', 'nbrjs/udp': 'src/udp.js', 'nbrjs/lib': 'src/lib.js' };
var strip = function (src) { return src.replace(/^\s*\/\/.*\n/gm, ''); };
var terser = null;
try { terser = require('terser'); } catch (e) { /* comments-only stripping */ }
// Native if / ?: around aggregate code become aligned branches (src/align.js), when acorn is installed.
var acorn = null;
try { acorn = require('acorn'); } catch (e) { /* the program as written: use branch() explicitly */ }

// Espruino-safe output: ES5, and no inlining (it leaves `var`s after a `return`,
// relying on hoisting that Espruino does not do).
var minify = function (src) {
  if (!terser) return Promise.resolve(strip(src));
  return terser.minify(src, { ecma: 5, compress: { passes: 2, keep_fargs: true, inline: false }, mangle: true, format: { comments: false } })
    .then(function (r) { return r.code; });
};
var module = function (id) { return minify(fs.readFileSync(path.join(root, mods[id]), 'utf8')); };

var main = function () {
  if (process.argv[2] === '--modules') {
    var dir = process.argv[3];
    return Promise.all(Object.keys(mods).map(function (id) {
      return module(id).then(function (code) {
        var f = path.join(dir, id + '.js');
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, code);
      });
    }));
  }
  // Modules come from require('nbrjs...') and from the config's target: 'ble' (start() loads it).
  var seen = {}, order = [];
  var scan = function (src) {
    src.replace(/require\(['"](nbrjs[^'"]*)['"]\)|target:\s*['"](\w+)['"]/g, function (_, req, target) {
      var id = req || 'nbrjs/' + target;
      if (seen[id] || !mods[id]) return;
      seen[id] = true;
      scan(strip(fs.readFileSync(path.join(root, mods[id]), 'utf8')));
      order.push(id);
    });
  };
  var app = strip(fs.readFileSync(process.argv[2], 'utf8'));
  if (acorn) {
    var al = require('../src/align.js').transform(app, acorn);
    al.warnings.forEach(function (w) { console.error('warning: ' + w); });
    app = al.code;
  }
  scan(app);
  return Promise.all(order.map(module)).then(function (codes) {
    process.stdout.write(codes.map(function (c, i) {
      return 'Modules.addCached(' + JSON.stringify(order[i]) + ',' + JSON.stringify(c) + ');\n';
    }).join('') + app);
  });
};
main().catch(function (e) { console.error(e.message); process.exit(1); });
