#!/bin/sh
# Runs test/test.js on the real Espruino interpreter (Linux build, compiled once into .espruino/).
set -e
cd "$(dirname "$0")/.."
if [ ! -x .espruino/bin/espruino ]; then
  [ -d .espruino ] || git clone --depth 1 https://github.com/espruino/Espruino .espruino
  # TensorFlow off: it clashes with a system-wide abseil (C++17) and the tests do not need it.
  (cd .espruino && BOARD=LINUX USE_TENSORFLOW=0 make -j"$(nproc)")
fi
node scripts/bundle.js test/test.js > .espruino/bundle.js
.espruino/bin/espruino --test .espruino/bundle.js </dev/null | tee .espruino/out.log
grep -q "ALL OK" .espruino/out.log
