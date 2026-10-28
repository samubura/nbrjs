// Inlines the nbrjs modules an app requires, as the Espruino Web IDE does with Modules.addCached.
// Usage: node scripts/bundle.js app.js > app.bundle.js   (then upload with the Web IDE or `espruino` CLI)
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var mods = { 'nbrjs': 'src/core.js', 'nbrjs/sim': 'src/sim.js', 'nbrjs/ble': 'src/ble.js' };
// Full-line comments cost RAM on the device: Espruino keeps function source.
var read = function (f) { return fs.readFileSync(f, 'utf8').replace(/^\s*\/\/.*\n/gm, ''); };

var out = '', seen = {};
// Modules come from require('nbrjs...') and from the config's target: 'ble' (start() loads it).
var scan = function (src) {
  src.replace(/require\(['"](nbrjs[^'"]*)['"]\)|target:\s*['"](\w+)['"]/g, function (_, req, target) {
    var id = req || 'nbrjs/' + target;
    if (seen[id] || !mods[id]) return;
    seen[id] = true;
    var code = read(path.join(root, mods[id]));
    scan(code);
    out += 'Modules.addCached(' + JSON.stringify(id) + ',' + JSON.stringify(code) + ');\n';
  });
};
var app = read(process.argv[2]);
scan(app);
process.stdout.write(out + app);
