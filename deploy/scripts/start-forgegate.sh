#!/usr/bin/env bash
set -euo pipefail

printf '[legacy-alias] %s\n' 'start-forgegate.sh is deprecated and will be removed after 2026-12-31. Use start-forgeframe.sh instead.' >&2
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/start-forgeframe.sh" "$@"
