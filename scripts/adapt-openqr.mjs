import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const basePath = "/tools/openqr";

const patches = [
  {
    file: "app/layout.tsx",
    replacements: [
      ['"/favicon.ico"', `"${basePath}/favicon.ico"`],
      ['"/favicon.svg"', `"${basePath}/favicon.svg"`],
      ['"/apple-touch-icon.png"', `"${basePath}/apple-touch-icon.png"`],
    ],
  },
  {
    file: "components/site/logo.tsx",
    replacements: [
      ['"/openqr-logo-stacked.svg"', `"${basePath}/openqr-logo-stacked.svg"`],
      ['"/openqr-logo-stacked-dark.svg"', `"${basePath}/openqr-logo-stacked-dark.svg"`],
    ],
  },
];

for (const patch of patches) {
  const path = resolve(root, patch.file);
  let source = await readFile(path, "utf8");

  for (const [from, to] of patch.replacements) {
    const occurrences = source.split(from).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `${patch.file}: expected exactly one occurrence of ${from}, found ${occurrences}`,
      );
    }
    source = source.replace(from, to);
  }

  await writeFile(path, source);
  console.log(`Adapted ${patch.file} for ${basePath}`);
}
