#!/bin/bash
set -eu
mode="${1:-install}"
case "$mode" in install|update|repair|verify) ;; *) echo 'Failed: mode must be install, update, repair, or verify.' >&2; exit 1 ;; esac
if [ "$(uname -s)" != Darwin ]; then echo 'Failed: setup requires macOS.' >&2; exit 1; fi
case "$(uname -m)" in arm64|x86_64) ;; *) echo 'Failed: unsupported CPU architecture.' >&2; exit 1 ;; esac
if ! command -v node >/dev/null 2>&1; then echo 'Requires User Action: install Node.js >=24, then rerun setup. No project or client configuration was changed.' >&2; exit 1; fi
if ! node -e 'if (Number(process.versions.node.split(".")[0]) < 24) process.exit(1)' ; then echo 'Requires User Action: Node.js >=24 is required. No project or client configuration was changed.' >&2; exit 1; fi
if ! command -v git >/dev/null 2>&1; then echo 'Requires User Action: install git, then rerun setup.' >&2; exit 1; fi
project_dir="$(cd -- "$(dirname -- "$0")" && pwd -P)"
cd -- "$project_dir"
exec node installers/setup.ts "$mode"
