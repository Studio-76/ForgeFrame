#!/usr/bin/env bash
set -euo pipefail

printf '[legacy-alias] %s\n' 'backup-forgegate.sh is deprecated and will be removed after 2026-12-31. Use backup-forgeframe.sh instead.' >&2
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backup-forgeframe.sh" "$@"
