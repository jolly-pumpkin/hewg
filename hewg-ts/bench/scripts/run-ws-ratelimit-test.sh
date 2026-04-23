#!/usr/bin/env bash
set -euo pipefail
for cond in 1 2 3 4; do
  for seed in 1 2 3; do
    echo "=== ws-rate-limit cond=$cond seed=$seed ==="
    bun run bench -- run-cc --task ws-rate-limit --condition "$cond" --seed "$seed" --model haiku --force --live
  done
done
