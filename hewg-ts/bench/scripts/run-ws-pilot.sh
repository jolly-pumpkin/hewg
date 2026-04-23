#!/usr/bin/env bash
set -euo pipefail
for task in ws-retry ws-cache ws-html-export ws-rate-limit; do
  for cond in 1 4; do
    echo "=== task=$task cond=$cond ==="
    bun run bench -- run-cc --task "$task" --condition "$cond" --seed 1 --model haiku --force --live
  done
done
