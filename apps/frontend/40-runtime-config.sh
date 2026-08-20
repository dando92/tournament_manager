#!/bin/sh
set -eu

envsubst '${PUBLIC_API_URL} ${PUBLIC_REALTIME_URL}' \
  < /etc/tournament-manager/runtime-config.template.js \
  > /usr/share/nginx/html/runtime-config.js
