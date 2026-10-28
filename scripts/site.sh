#!/bin/sh
# Builds the static site into _site/: tutorials + playground (web/), the library they load (src/),
# and modules/ for the Espruino Web IDE (Settings > Communications > Module URL: <site>/modules).
set -e
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site
cp -r web src _site/
# Minified for devices (needs devDependencies: npm ci). Served as <site>/modules/nbrjs.js, nbrjs/ble.js...
node scripts/bundle.js --modules _site/modules
printf '<!doctype html>\n<meta http-equiv="refresh" content="0; url=web/">\n<a href="web/">NbrJS</a>\n' > _site/index.html
