#!/bin/sh
# Builds the static site into _site/: tutorials + playground (web/), the library they load (src/),
# and modules/ for the Espruino Web IDE (Settings > Communications > Module URL: <site>/modules).
set -e
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site/modules/nbrjs
cp -r web src _site/
cp src/core.js _site/modules/nbrjs.js
cp src/ble.js _site/modules/nbrjs/ble.js
printf '<!doctype html>\n<meta http-equiv="refresh" content="0; url=web/">\n<a href="web/">NbrJS</a>\n' > _site/index.html
