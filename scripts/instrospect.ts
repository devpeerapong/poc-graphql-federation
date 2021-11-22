import yaml from "yaml";
import util from "util";
import { readFileSync } from "fs";
import childProcess from "child_process";

const exec = util.promisify(childProcess.exec);

type Config = {
  subgraphs: Record<string, { routing_url: string; schema: { file: string } }>;
};

const file = readFileSync("./gateway/supergraph-config.yaml", "utf-8");
const config: Config = yaml.parse(file);

(async () => {
  await Promise.all(
    Object.entries(config.subgraphs)
      .map(([key, value]) => ({
        key,
        command: `rover subgraph introspect ${value.routing_url} > gateway/${value.schema.file}`,
      }))
      .map(async ({ command, key }) => {
        const { stdout, stderr } = await exec(command);

        console.log(key, stdout || stderr);
      })
  );
})();
