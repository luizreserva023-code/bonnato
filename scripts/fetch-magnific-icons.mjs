import fs from "node:fs/promises";
import path from "node:path";

const MAGNIFIC_ICON_RECIPES = [
  { name: "pizza-category", term: "pizza slice outline premium app icon" },
  { name: "delivery-tracking", term: "delivery scooter route modern outline icon" },
  { name: "loyalty-club", term: "crown reward premium loyalty icon" },
  { name: "checkout-fast", term: "credit card lightning checkout icon" },
  { name: "support-chat", term: "chat bubble concierge modern icon" },
];

const apiKey = process.env.MAGNIFIC_API_KEY;

if (!apiKey) {
  console.error("MAGNIFIC_API_KEY is required to fetch icons from Magnific.");
  process.exit(1);
}

const root = process.cwd();
const outDir = path.join(root, "client", "public", "magnific-icons");
await fs.mkdir(outDir, { recursive: true });

async function requestJson(url) {
  const response = await fetch(url, {
    headers: {
      "x-magnific-api-key": apiKey,
      "Accept-Language": "pt-BR",
    },
  });

  if (!response.ok) {
    throw new Error(`Magnific request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

for (const recipe of MAGNIFIC_ICON_RECIPES) {
  const searchUrl = new URL("https://api.magnific.com/v1/icons");
  searchUrl.searchParams.set("term", recipe.term);
  searchUrl.searchParams.set("per_page", "1");

  const searchResult = await requestJson(searchUrl);
  const icon = searchResult?.data?.[0];

  if (!icon?.id) {
    console.warn(`No Magnific result found for "${recipe.name}" (${recipe.term}).`);
    continue;
  }

  const downloadUrl = new URL(`https://api.magnific.com/v1/icons/${icon.id}/download`);
  downloadUrl.searchParams.set("format", "svg");

  const downloadResult = await requestJson(downloadUrl);
  const assetUrl = downloadResult?.data?.url;

  if (!assetUrl) {
    console.warn(`No download URL returned for "${recipe.name}".`);
    continue;
  }

  const iconResponse = await fetch(assetUrl);
  if (!iconResponse.ok) {
    throw new Error(`Failed to download icon payload for ${recipe.name}.`);
  }

  const iconSvg = await iconResponse.text();
  await fs.writeFile(path.join(outDir, `${recipe.name}.svg`), iconSvg, "utf-8");

  await fs.writeFile(
    path.join(outDir, `${recipe.name}.json`),
    JSON.stringify(
      {
        recipe,
        source: {
          id: icon.id,
          slug: icon.slug,
          name: icon.name,
          family: icon.family?.name,
          style: icon.style?.name,
        },
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`Fetched ${recipe.name} from Magnific (icon ${icon.id}).`);
}
