import { describe, expect, test } from "bun:test";
import { versionString } from "../src/commands/version.ts";

const CLI_ENTRY = new URL("../src/cli.ts", import.meta.url).pathname;

async function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: [process.execPath, "run", CLI_ENTRY, ...args],
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
}

describe("hewg version", () => {
  test("exits 0 and prints version + platform", async () => {
    const { code, stdout } = await runCli(["version"]);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^hewg 0\.0\.1 \(/);
    expect(stdout.trim()).toBe(versionString());
  });
});
