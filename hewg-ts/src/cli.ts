import { cac } from "cac";
import pkg from "../package.json" with { type: "json" };
import { runCheck, type CheckFormat } from "./commands/check.ts";
import { runContract, type ContractFormat } from "./commands/contract.ts";
import { runInit } from "./commands/init.ts";
import { runSummary } from "./commands/summary.ts";
import { versionString } from "./commands/version.ts";

const cli = cac("hewg");

cli
  .command("version", "Print version and platform")
  .action(() => {
    console.log(versionString());
  });

cli
  .command("contract <symbol>", "Print the structured contract for one symbol")
  .option("--project <path>", "Path to tsconfig.json")
  .option("--format <fmt>", "Output format: json (default) or human")
  .action((symbol: string, options: { project?: string; format?: string }) => {
    const fmt = options.format === "human" ? "human" : "json"
    const result = runContract(symbol, {
      project: options.project,
      format: fmt as ContractFormat,
    });
    if (result.stdout.length > 0) process.stdout.write(result.stdout + "\n");
    if (result.stderr.length > 0) process.stderr.write(result.stderr + "\n");
    process.exit(result.exitCode);
  });

cli
  .command("check", "Check annotated functions for effect-row violations")
  .option("--project <path>", "Path to tsconfig.json")
  .option("--format <fmt>", "Output format: human (default), json, or sarif")
  .action((options: { project?: string; format?: string }) => {
    const fmt: CheckFormat =
      options.format === "json"
        ? "json"
        : options.format === "sarif"
          ? "sarif"
          : "human"
    const result = runCheck({ project: options.project, format: fmt })
    if (result.stdout.length > 0) process.stdout.write(result.stdout + "\n")
    if (result.stderr.length > 0) process.stderr.write(result.stderr)
    process.exit(result.exitCode)
  });

cli
  .command("summary <module>", "Print a compact module summary")
  .option("--project <path>", "Path to tsconfig.json")
  .action((mod: string, options: { project?: string }) => {
    const result = runSummary(mod, { project: options.project });
    if (result.stdout.length > 0) process.stdout.write(result.stdout + "\n");
    if (result.stderr.length > 0) process.stderr.write(result.stderr + "\n");
    process.exit(result.exitCode);
  });

cli
  .command("init [path]", "Scaffold hewg.config.json in a TypeScript project")
  .action((path: string | undefined) => {
    const result = runInit({ path });
    if (result.stdout.length > 0) process.stdout.write(result.stdout);
    if (result.stderr.length > 0) process.stderr.write(result.stderr + "\n");
    process.exit(result.exitCode);
  });

cli.help();
cli.version(pkg.version);

const parsed = cli.parse(process.argv, { run: false });

if (parsed.options.help || parsed.options.version) {
  // cac already handled output during parse()
} else if (!cli.matchedCommand) {
  cli.outputHelp();
} else {
  await cli.runMatchedCommand();
}
