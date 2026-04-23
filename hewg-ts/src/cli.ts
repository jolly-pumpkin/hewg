import { cac } from "cac";
import pkg from "../package.json" with { type: "json" };
import { runBaseline, type BaselineSubcommand } from "./commands/baseline.ts";
import { runCheck, type CheckFormat } from "./commands/check.ts";
import { runContract, type ContractFormat } from "./commands/contract.ts";
import { runInferCommand, type InferFormat } from "./commands/infer.ts";
import { runInit } from "./commands/init.ts";
import { runScope, type ScopeFormat } from "./commands/scope.ts";
import { runSummary } from "./commands/summary.ts";
import { versionString } from "./commands/version.ts";

/**
 * @hewg-module cli
 */
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
    const fmt: ContractFormat = options.format === "human" ? "human" : "json"
    const result = runContract(symbol, {
      project: options.project,
      format: fmt,
    });
    if (result.stdout.length > 0) process.stdout.write(result.stdout + "\n");
    if (result.stderr.length > 0) process.stderr.write(result.stderr + "\n");
    process.exitCode = result.exitCode;
  });

cli
  .command("check", "Check annotated functions for effect-row violations")
  .option("--project <path>", "Path to tsconfig.json")
  .option("--format <fmt>", "Output format: human (default), json, or sarif")
  .option("--no-baseline", "Ignore the baseline file and report all violations")
  .action((options: { project?: string; format?: string; baseline?: boolean }) => {
    const fmt: CheckFormat =
      options.format === "json"
        ? "json"
        : options.format === "sarif"
          ? "sarif"
          : "human"
    const result = runCheck({ project: options.project, format: fmt, noBaseline: options.baseline === false })
    if (result.stdout.length > 0) process.stdout.write(result.stdout + "\n")
    if (result.stderr.length > 0) process.stderr.write(result.stderr)
    process.exitCode = result.exitCode
  });

cli
  .command("baseline <subcommand>", "Manage the violation baseline (update, status)")
  .option("--project <path>", "Path to tsconfig.json")
  .action((subcommand: string, options: { project?: string }) => {
    if (subcommand !== "update" && subcommand !== "status") {
      process.stderr.write(`unknown baseline subcommand: ${subcommand}\nusage: hewg baseline <update|status>\n`)
      process.exitCode = 2
      return
    }
    const result = runBaseline({ subcommand: subcommand as BaselineSubcommand, project: options.project })
    if (result.stdout.length > 0) process.stdout.write(result.stdout)
    if (result.stderr.length > 0) process.stderr.write(result.stderr)
    process.exitCode = result.exitCode
  });

cli
  .command("summary <module>", "Print a compact module summary")
  .option("--project <path>", "Path to tsconfig.json")
  .action((mod: string, options: { project?: string }) => {
    const result = runSummary(mod, { project: options.project });
    if (result.stdout.length > 0) process.stdout.write(result.stdout + "\n");
    if (result.stderr.length > 0) process.stderr.write(result.stderr + "\n");
    process.exitCode = result.exitCode;
  });

cli
  .command("infer", "Infer @effects annotations for unannotated functions")
  .option("--project <path>", "Path to tsconfig.json")
  .option("--format <fmt>", "Output format: diff (default), json, or apply")
  .action((options: { project?: string; format?: string }) => {
    const fmt: InferFormat =
      options.format === "json"
        ? "json"
        : options.format === "apply"
          ? "apply"
          : "diff"
    const result = runInferCommand({ project: options.project, format: fmt })
    if (result.stdout.length > 0) process.stdout.write(result.stdout + "\n")
    if (result.stderr.length > 0) process.stderr.write(result.stderr)
    process.exitCode = result.exitCode
  });

cli
  .command("scope <symbol>", "Show the blast radius of a function (callers and callees)")
  .option("--project <path>", "Path to tsconfig.json")
  .option("--format <fmt>", "Output format: human (default) or json")
  .option("--depth <n>", "Maximum traversal depth (default: 5)")
  .action((symbol: string, options: { project?: string; format?: string; depth?: string }) => {
    const fmt: ScopeFormat = options.format === "json" ? "json" : "human"
    const depth = options.depth !== undefined ? parseInt(options.depth, 10) : undefined
    const result = runScope(symbol, { project: options.project, format: fmt, depth })
    if (result.stdout.length > 0) process.stdout.write(result.stdout + "\n")
    if (result.stderr.length > 0) process.stderr.write(result.stderr)
    process.exitCode = result.exitCode
  });

cli
  .command("init [path]", "Scaffold hewg.config.json in a TypeScript project")
  .option("--claude-md", "Generate a CLAUDE.md from the annotation graph")
  .action((path: string | undefined, options: { claudeMd?: boolean }) => {
    const result = runInit({ path, claudeMd: options.claudeMd });
    if (result.stdout.length > 0) process.stdout.write(result.stdout);
    if (result.stderr.length > 0) process.stderr.write(result.stderr + "\n");
    process.exitCode = result.exitCode;
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
