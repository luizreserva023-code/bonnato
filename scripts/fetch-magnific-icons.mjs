import fs from "node:fs/promises";
import path from "node:path";

const MAGNIFIC_ICON_RECIPES = [
  { id: "pizza-category", label: "Pizza Category", term: "pizza slice outline premium app icon", fallbackIconKey: "pizza" },
  { id: "delivery-tracking", label: "Delivery Tracking", term: "delivery scooter route modern outline icon", fallbackIconKey: "drink" },
  { id: "loyalty-club", label: "Loyalty Club", term: "crown reward premium loyalty icon", fallbackIconKey: "featured" },
  { id: "checkout-fast", label: "Checkout Fast", term: "credit card lightning checkout icon", fallbackIconKey: "combo" },
  { id: "support-chat", label: "Support Chat", term: "chat bubble concierge modern icon", fallbackIconKey: "menu" },
];

const MAGNIFIC_CATEGORY_IMAGE_RECIPES = [
  {
    id: "pizzas-premium",
    label: "Pizzas Premium",
    term: "artisan pizza close up premium food photo",
    categoryKeys: ["pizza", "pizzas"],
    fallbackSrc: "/brand/pizza-1-margherita.jpg",
  },
  {
    id: "calzones-premium",
    label: "Calzones Premium",
    term: "golden baked calzone premium food photo",
    categoryKeys: ["calzone", "calzones", "lanche", "lanches"],
    fallbackSrc: "/brand/pizza-14.png",
  },
  {
    id: "massas-premium",
    label: "Massas Premium",
    term: "lasagna premium italian food photo",
    categoryKeys: ["massa", "massas", "lasanha", "lasanhas", "pasta"],
    fallbackSrc: "/brand/pizza-15.jpg",
  },
  {
    id: "bebidas-premium",
    label: "Bebidas Premium",
    term: "sparkling soda premium product photo",
    categoryKeys: ["bebida", "bebidas", "drink", "drinks", "refrigerante"],
    fallbackSrc: "/brand/pizza-8.jpg",
  },
  {
    id: "sobremesas-premium",
    label: "Sobremesas Premium",
    term: "ice cream dessert premium food photo",
    categoryKeys: ["sobremesa", "sobremesas", "sorvete", "sorvetes", "dessert"],
    fallbackSrc: "/brand/pizza-10.webp",
  },
  {
    id: "empanados-premium",
    label: "Empanados Premium",
    term: "crispy appetizer premium food photo",
    categoryKeys: ["empanado", "empanados", "extra", "extras", "snack"],
    fallbackSrc: "/brand/pizza-16.jpg",
  },
];

const MAGNIFIC_AVATAR_RECIPES = [
  { id: "avatar-chef-enzo", label: "Chef Enzo", term: "cartoon italian pizza chef portrait warm artisan restaurant branding", fallbackSrc: "https://api.dicebear.com/9.x/adventurer/svg?seed=ChefEnzo&backgroundColor=f2d4c7,e7c1b2,d8b095" },
  { id: "avatar-bella", label: "Bella", term: "cartoon smiling hostess portrait warm premium pizzeria branding", fallbackSrc: "https://api.dicebear.com/9.x/adventurer/svg?seed=BellaBonatto&backgroundColor=f5ddd2,e9c4bb,ead8b3" },
  { id: "avatar-dante", label: "Dante", term: "cartoon artisan portrait wood oven pizzeria warm identity", fallbackSrc: "https://api.dicebear.com/9.x/adventurer/svg?seed=DanteForno&backgroundColor=e8ccb8,d7b197,dfe4d2" },
  { id: "avatar-mia", label: "Mia", term: "cartoon premium restaurant portrait warm elegant italian vibe", fallbackSrc: "https://api.dicebear.com/9.x/adventurer/svg?seed=MiaForneria&backgroundColor=f1d9d1,e7c7b5,dec59f" },
  { id: "avatar-luca", label: "Luca", term: "cartoon delivery and pizzeria portrait artisanal warm palette", fallbackSrc: "https://api.dicebear.com/9.x/adventurer/svg?seed=LucaMassa&backgroundColor=e4c3b0,d0a088,ddd8c8" },
  { id: "avatar-rosa", label: "Rosa", term: "cartoon family pizzeria portrait warm classic italian palette", fallbackSrc: "https://api.dicebear.com/9.x/adventurer/svg?seed=RosaBonatto&backgroundColor=f0d8c8,e5c1af,e1d8bf" },
];

const apiKey = process.env.MAGNIFIC_API_KEY;
const root = process.cwd();
const publicDir = path.join(root, "client", "public", "magnific");
const iconsDir = path.join(publicDir, "icons");
const categoryImagesDir = path.join(publicDir, "category-images");
const avatarPresetsDir = path.join(publicDir, "avatar-presets");

await fs.mkdir(iconsDir, { recursive: true });
await fs.mkdir(categoryImagesDir, { recursive: true });
await fs.mkdir(avatarPresetsDir, { recursive: true });

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

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

function extFromContentType(contentType, fallback = "jpg") {
  if (!contentType) return fallback;
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("jpeg")) return "jpg";
  return fallback;
}

async function downloadBinary(assetUrl) {
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Failed to download asset: ${assetUrl}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "",
  };
}

async function fetchIconAsset(recipe) {
  const searchUrl = new URL("https://api.magnific.com/v1/icons");
  searchUrl.searchParams.set("term", recipe.term);
  searchUrl.searchParams.set("per_page", "1");

  const searchResult = await requestJson(searchUrl);
  const icon = searchResult?.data?.[0];
  if (!icon?.id) throw new Error(`No icon found for ${recipe.id}`);

  const downloadUrl = new URL(`https://api.magnific.com/v1/icons/${icon.id}/download`);
  downloadUrl.searchParams.set("format", "svg");
  const downloadResult = await requestJson(downloadUrl);
  const assetUrl = downloadResult?.data?.url;
  if (!assetUrl) throw new Error(`No icon URL returned for ${recipe.id}`);

  const iconResponse = await fetch(assetUrl);
  if (!iconResponse.ok) throw new Error(`Failed to download icon for ${recipe.id}`);
  const svg = await iconResponse.text();
  const fileName = `${recipe.id}.svg`;
  await fs.writeFile(path.join(iconsDir, fileName), svg, "utf-8");

  return {
    id: recipe.id,
    label: recipe.label,
    term: recipe.term,
    src: `/magnific/icons/${fileName}`,
    fallbackIconKey: recipe.fallbackIconKey,
  };
}

async function fetchResourceAsset(recipe, { outputDir, outputPrefix, extraFields = {} }) {
  const searchUrl = new URL("https://api.magnific.com/v1/resources");
  searchUrl.searchParams.set("term", recipe.term);
  searchUrl.searchParams.set("limit", "1");
  searchUrl.searchParams.set("order", "relevance");

  const searchResult = await requestJson(searchUrl);
  const resource = searchResult?.data?.[0];
  const assetUrl = resource?.image?.source?.url;
  if (!assetUrl) throw new Error(`No resource URL found for ${recipe.id}`);

  const { buffer, contentType } = await downloadBinary(assetUrl);
  const ext = extFromContentType(contentType, "jpg");
  const fileName = `${outputPrefix}-${recipe.id}.${ext}`;
  await fs.writeFile(path.join(outputDir, fileName), buffer);

  return {
    id: recipe.id,
    label: recipe.label,
    term: recipe.term,
    src: `/magnific/${path.basename(outputDir)}/${fileName}`,
    ...extraFields,
  };
}

async function writeFallbackManifests() {
  await writeJson(
    path.join(iconsDir, "manifest.json"),
    MAGNIFIC_ICON_RECIPES.map((recipe) => ({
      id: recipe.id,
      label: recipe.label,
      term: recipe.term,
      src: null,
      fallbackIconKey: recipe.fallbackIconKey,
    })),
  );

  await writeJson(
    path.join(categoryImagesDir, "manifest.json"),
    MAGNIFIC_CATEGORY_IMAGE_RECIPES.map((recipe) => ({
      id: recipe.id,
      label: recipe.label,
      term: recipe.term,
      src: recipe.fallbackSrc,
      categoryKeys: recipe.categoryKeys,
    })),
  );

  await writeJson(
    path.join(avatarPresetsDir, "manifest.json"),
    MAGNIFIC_AVATAR_RECIPES.map((recipe) => ({
      id: recipe.id,
      label: recipe.label,
      style: "cartoon",
      src: recipe.fallbackSrc,
    })),
  );
}

if (!apiKey) {
  await writeFallbackManifests();
  console.log("MAGNIFIC_API_KEY não encontrada. Manifestos fallback foram gerados em client/public/magnific/.");
  process.exit(0);
}

const icons = [];
for (const recipe of MAGNIFIC_ICON_RECIPES) {
  try {
    icons.push(await fetchIconAsset(recipe));
    console.log(`Fetched icon ${recipe.id} from Magnific.`);
  } catch (error) {
    console.warn(`Icon fallback usado para ${recipe.id}: ${error.message}`);
    icons.push({
      id: recipe.id,
      label: recipe.label,
      term: recipe.term,
      src: null,
      fallbackIconKey: recipe.fallbackIconKey,
    });
  }
}

const categoryImages = [];
for (const recipe of MAGNIFIC_CATEGORY_IMAGE_RECIPES) {
  try {
    categoryImages.push(
      await fetchResourceAsset(recipe, {
        outputDir: categoryImagesDir,
        outputPrefix: "category",
        extraFields: { categoryKeys: recipe.categoryKeys },
      }),
    );
    console.log(`Fetched category image ${recipe.id} from Magnific.`);
  } catch (error) {
    console.warn(`Category image fallback usada para ${recipe.id}: ${error.message}`);
    categoryImages.push({
      id: recipe.id,
      label: recipe.label,
      term: recipe.term,
      src: recipe.fallbackSrc,
      categoryKeys: recipe.categoryKeys,
    });
  }
}

const avatars = [];
for (const recipe of MAGNIFIC_AVATAR_RECIPES) {
  try {
    avatars.push(
      await fetchResourceAsset(recipe, {
        outputDir: avatarPresetsDir,
        outputPrefix: "avatar",
        extraFields: { style: "cartoon" },
      }),
    );
    console.log(`Fetched avatar preset ${recipe.id} from Magnific.`);
  } catch (error) {
    console.warn(`Avatar fallback usado para ${recipe.id}: ${error.message}`);
    avatars.push({
      id: recipe.id,
      label: recipe.label,
      style: "cartoon",
      src: recipe.fallbackSrc,
    });
  }
}

await writeJson(path.join(iconsDir, "manifest.json"), icons);
await writeJson(path.join(categoryImagesDir, "manifest.json"), categoryImages);
await writeJson(path.join(avatarPresetsDir, "manifest.json"), avatars);

console.log("Manifestos Magnific atualizados com sucesso.");
