#!/usr/bin/env bash
set -euo pipefail

printf '[legacy-alias] %s\n' 'bootstrap-forgegate.sh is deprecated and will be removed after 2026-12-31. Use bootstrap-forgeframe.sh instead.' >&2
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bootstrap-forgeframe.sh" "$@"
