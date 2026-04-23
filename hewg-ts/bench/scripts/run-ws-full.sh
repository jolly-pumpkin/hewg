#!/usr/bin/env bash
set -euo pipefail
for task in ws-retry ws-cache ws-html-export ws-rate-limit; do
  for cond in 1 2 3 4; do
    for seed in 1 2 3; do
      echo "=== task=$task cond=$cond seed=$seed ==="
      bun run bench -- run-cc --task "$task" --condition "$cond" --seed "$seed" --model haiku --force --live
    done
  done
done
