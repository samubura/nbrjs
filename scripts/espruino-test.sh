#!/bin/sh
# Runs test/test.js on the real Espruino interpreter (Linux build, compiled once into .espruino/).
set -e
cd "$(dirname "$0")/.."
if [ ! -x .espruino/espruino ]; then
  git clone --depth 1 https://github.com/espruino/Espruino .espruino
  (cd .espruino && BOARD=LINUX make -j"$(nproc)")
fi
node scripts/bundle.js test/test.js > .espruino/bundle.js
.espruino/espruino --test .espruino/bundle.js </dev/null | tee .espruino/out.log
grep -q "ALL OK" .espruino/out.log
