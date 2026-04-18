import { cac } from "cac";
import pkg from "../package.json" with { type: "json" };
import { versionString } from "./commands/version.ts";

const cli = cac("hewg");

cli
  .command("version", "Print version and platform")
  .action(() => {
    console.log(versionString());
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
