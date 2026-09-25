import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_BASE64_CHARS,
  MAX_IMAGE_UPLOAD_BYTES,
  isAllowedImageMimeType,
} from "../shared/imageUpload.ts";

describe("image upload limits", () => {
  it("accepts five real MiB without losing capacity to base64 overhead", () => {
    expect(MAX_IMAGE_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
    const encodedLength = Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES).toString("base64").length;
    expect(MAX_IMAGE_BASE64_CHARS).toBeGreaterThanOrEqual(encodedLength);
  });

  it("keeps the accepted image formats explicit", () => {
    expect(isAllowedImageMimeType("image/jpeg")).toBe(true);
    expect(isAllowedImageMimeType("image/png")).toBe(true);
    expect(isAllowedImageMimeType("image/webp")).toBe(true);
    expect(isAllowedImageMimeType("image/gif")).toBe(true);
    expect(isAllowedImageMimeType("image/svg+xml")).toBe(false);
  });
});
