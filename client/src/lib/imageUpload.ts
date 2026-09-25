import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
  isAllowedImageMimeType,
} from "../../../shared/imageUpload";

export type ImageUploadScope =
  | "product"
  | "category"
  | "banner"
  | "carousel"
  | "notification"
  | "avatar";

export async function uploadImageFile(input: {
  file: File;
  scope: ImageUploadScope;
  storeId?: number;
}) {
  const { file, scope, storeId } = input;

  if (!isAllowedImageMimeType(file.type)) {
    throw new Error("Use JPG, PNG, WebP ou GIF.");
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error(`A imagem deve ter no máximo ${MAX_IMAGE_UPLOAD_LABEL}.`);
  }

  const params = new URLSearchParams({ scope });
  if (storeId) params.set("storeId", String(storeId));

  const response = await fetch(`/api/uploads/image?${params.toString()}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": file.type,
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error(`A imagem deve ter no máximo ${MAX_IMAGE_UPLOAD_LABEL}.`);
    }
    throw new Error(payload?.error || "Não foi possível enviar a imagem.");
  }

  if (!payload?.url) {
    throw new Error("O servidor não retornou a URL da imagem.");
  }

  return payload as {
    url: string;
    originalBytes: number;
    storedBytes: number;
  };
}
