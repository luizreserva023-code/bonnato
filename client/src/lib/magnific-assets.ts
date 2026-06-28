export type MagnificIconAsset = {
  id: string;
  label: string;
  term: string;
  src: string | null;
  fallbackIconKey?: string;
};

export type MagnificCategoryImageAsset = {
  id: string;
  label: string;
  term: string;
  src: string;
  categoryKeys: string[];
};

export type MagnificAvatarPreset = {
  id: string;
  label: string;
  style: string;
  src: string;
};

export const MAGNIFIC_ICONS_MANIFEST_URL = "/magnific/icons/manifest.json";
export const MAGNIFIC_CATEGORY_IMAGES_MANIFEST_URL = "/magnific/category-images/manifest.json";
export const MAGNIFIC_AVATAR_PRESETS_MANIFEST_URL = "/magnific/avatar-presets/manifest.json";

async function readJsonManifest<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Manifesto indisponivel: ${url}`);
  }

  const json = await response.json();
  if (!Array.isArray(json)) return [];
  return json as T[];
}

export async function loadMagnificIcons() {
  return readJsonManifest<MagnificIconAsset>(MAGNIFIC_ICONS_MANIFEST_URL);
}

export async function loadMagnificCategoryImages() {
  return readJsonManifest<MagnificCategoryImageAsset>(MAGNIFIC_CATEGORY_IMAGES_MANIFEST_URL);
}

export async function loadMagnificAvatarPresets() {
  return readJsonManifest<MagnificAvatarPreset>(MAGNIFIC_AVATAR_PRESETS_MANIFEST_URL);
}
