import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const publicDir = path.join(root, "client", "public");
const brandDir = path.join(publicDir, "brand");

const sourceIcon = path.join(brandDir, "bonatto-logo-home.jpg");
const sourceSplash = path.join(brandDir, "onboarding-premium-v1.png");

const outputFiles = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "driver-icon-192.png", size: 192 },
  { file: "driver-icon-512.png", size: 512 },
  { file: "driver-apple-touch-icon.png", size: 180 },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function buildIcons() {
  await ensureDir(publicDir);

  for (const asset of outputFiles) {
    await sharp(sourceIcon)
      .resize(asset.size, asset.size, {
        fit: "cover",
        position: "centre",
      })
      .png()
      .toFile(path.join(publicDir, asset.file));
  }
}

async function buildSplash() {
  const splashOut = path.join(brandDir, "mobile-splash.png");

  await sharp({
    create: {
      width: 2048,
      height: 2048,
      channels: 4,
      background: "#6E0D12",
    },
  })
    .composite([
      {
        input: await sharp(sourceSplash).resize(1400, 1400, { fit: "contain" }).png().toBuffer(),
        gravity: "center",
      },
    ])
    .png()
    .toFile(splashOut);
}

await buildIcons();
await buildSplash();

console.log("Mobile assets generated in client/public.");
