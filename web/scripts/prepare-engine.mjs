import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
execFileSync(process.execPath, [root + "research/validation/build.mjs"], {
  stdio: "inherit",
});
await build({
  entryPoints: [root + "research/validation/adapter.mjs"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: root + "web/src/generated/research.mjs",
  plugins: [
    {
      name: "embed-pinned-timezone-fixture",
      setup(b) {
        b.onLoad({ filter: /resolve-wall-time\.mjs$/ }, async (args) => {
          const source = await readFile(args.path, "utf8");
          const fixture = JSON.parse(
            await readFile(
              path.join(
                path.dirname(args.path),
                "fixtures/seoul-transitions.json",
              ),
              "utf8",
            ),
          );
          const target =
            "JSON.parse(readFileSync(new URL('./fixtures/seoul-transitions.json', import.meta.url)))";
          if (!source.includes(target))
            throw new Error("Timezone source changed; review bundling");
          return {
            contents: source.replace(target, JSON.stringify(fixture)),
            loader: "js",
          };
        });
      },
    },
  ],
});
