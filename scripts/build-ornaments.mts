import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const source = path.join(root, "assets", "ornaments");
const target = path.join(root, "components", "ornament", "paths.ts");

function attribute(svg: string, name: string): string | null {
  return new RegExp(`[ ]${name}="([^"]+)"`).exec(svg)?.[1] ?? null;
}

const entries: string[] = [];
for (const file of (await readdir(source)).filter((name) => name.endsWith(".svg")).sort()) {
  const svg = await readFile(path.join(source, file), "utf8");
  const viewBox = attribute(svg, "viewBox");
  if (!viewBox) throw new Error(`${file}: no viewBox`);
  const [, , width, height] = viewBox.split(/\s+/).map(Number);
  const stroke = attribute(svg.slice(0, svg.indexOf(">")), "stroke-width");
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((match) => match[1]!);
  if (!paths.length) throw new Error(`${file}: no paths`);
  const name = path.basename(file, ".svg");
  entries.push(
    `  "${name}": {\n    width: ${width},\n    height: ${height},\n    mode: "${stroke ? "stroke" : "fill"}",\n    paths: [\n${paths.map((d) => `      "${d}",`).join("\n")}\n    ],\n  },`,
  );
}

await writeFile(
  target,
  `export type OrnamentShape = {\n  width: number;\n  height: number;\n  mode: "stroke" | "fill";\n  paths: readonly string[];\n};\n\nexport const ornamentShapes = {\n${entries.join("\n")}\n} as const satisfies Record<string, OrnamentShape>;\n\nexport type OrnamentName = keyof typeof ornamentShapes;\n`,
);
console.log(`wrote ${path.relative(root, target)} (${entries.length} ornaments)`);
