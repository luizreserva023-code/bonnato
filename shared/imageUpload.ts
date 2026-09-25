export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_LABEL = "5 MB";

// Base64 expands binary data by roughly 4/3. Keep a small safety margin
// for legacy tRPC upload procedures while the UI uses binary uploads.
export const MAX_IMAGE_BASE64_CHARS =
  Math.ceil(MAX_IMAGE_UPLOAD_BYTES / 3) * 4 + 16;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageMimeType = typeof ALLOWED_IMAGE_MIME_TYPES[number];

export function isAllowedImageMimeType(value: string): value is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}
