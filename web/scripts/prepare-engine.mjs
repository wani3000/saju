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

await build({
  entryPoints: [root + "web/scripts/reading-entry.mjs"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: root + "web/src/generated/selected-reading.mjs",
  plugins: [{
    name: "embed-reviewed-reading-sources",
    setup(b) {
      b.onLoad({filter: /(?:reading-rules|selected-reading|beta-reading)\.mjs$/}, async args => {
        let source = await readFile(args.path, "utf8");
        const pattern = /JSON\.parse\(readFileSync\(new URL\('([^']+\.json)', import\.meta\.url\)\)\)/g;
        const matches = [...source.matchAll(pattern)];
        if (matches.length !== 1) throw new Error("Reading source changed; review bundling");
        for (const match of matches) {
          const json = JSON.parse(await readFile(path.resolve(path.dirname(args.path), match[1]), "utf8"));
          source = source.replace(match[0], JSON.stringify(json));
        }
        return {contents: source, loader: "js"};
      });
    },
  }],
});
