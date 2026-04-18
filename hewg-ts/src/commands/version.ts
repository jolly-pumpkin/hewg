import pkg from "../../package.json" with { type: "json" };

export function versionString(): string {
  const platform = process.platform;
  const arch = process.arch;
  const runtime = typeof Bun !== "undefined" ? `bun-${Bun.version}` : `node-${process.versions.node}`;
  return `hewg ${pkg.version} (${platform}/${arch}, ${runtime})`;
}
