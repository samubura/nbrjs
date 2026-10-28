#!/bin/sh
# Runs test/test.js on the real Espruino interpreter (Linux build, compiled once into .espruino/).
set -e
cd "$(dirname "$0")/.."
if [ ! -x .espruino/espruino ]; then
  git clone --depth 1 https://github.com/espruino/Espruino .espruino
  (cd .espruino && BOARD=LINUX make -j"$(nproc)")
fi
# Bundle as the Espruino IDE does: modules go through Modules.addCached. The global `nbrjs`
# makes sim.js share the same core instance as the tests.
node -e '
var fs = require("fs");
var mod = function (id, f) { return "Modules.addCached(" + JSON.stringify(id) + "," + JSON.stringify(fs.readFileSync(f, "utf8")) + ");\n"; };
process.stdout.write(mod("../src/core.js", "src/core.js") + "var nbrjs = require(\"../src/core.js\");\n" +
  mod("../src/sim.js", "src/sim.js") + fs.readFileSync("test/test.js", "utf8"));
' > .espruino/bundle.js
.espruino/espruino --test .espruino/bundle.js </dev/null | tee .espruino/out.log
grep -q "ALL OK" .espruino/out.log
