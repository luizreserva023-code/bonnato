const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, ".deploy-bundle");

function copyRequired(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Required deployment input is missing: ${source}`);
  }
  fs.cpSync(source, destination, { recursive: true });
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

copyRequired(path.join(root, "dist"), path.join(out, "dist"));
copyRequired(
  path.join(root, "drizzle", "migrations"),
  path.join(out, "drizzle", "migrations"),
);
copyRequired(path.join(root, ".platform"), path.join(out, ".platform"));

for (const file of ["package.json", "package-lock.json"]) {
  copyRequired(path.join(root, file), path.join(out, file));
}

const npmrc = path.join(root, ".npmrc");
if (fs.existsSync(npmrc)) fs.copyFileSync(npmrc, path.join(out, ".npmrc"));

fs.writeFileSync(
  path.join(out, "Procfile"),
  "web: node dist/index.js\n",
  "utf8",
);

const manifest = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  commit: process.env.GITHUB_SHA || process.env.GIT_COMMIT || null,
};
fs.writeFileSync(
  path.join(out, "deployment-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

console.log(`[deploy:bundle] Prepared ${out}`);
