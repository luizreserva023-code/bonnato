/**
 * imageUtils.ts — Utilitários de processamento de imagem no servidor.
 *
 * Usa `sharp` para converter e comprimir imagens para WebP antes de salvar
 * no storage, reduzindo o tamanho em até 80% sem perda visual perceptível.
 *
 * Para trocar a biblioteca de compressão no futuro, basta alterar este arquivo.
 */

import sharp from "sharp";

export interface CompressResult {
  buffer: Buffer;
  mimeType: "image/webp";
  /** Extensão sem ponto, ex: "webp" */
  ext: "webp";
  /** Tamanho original em bytes */
  originalSize: number;
  /** Tamanho após compressão em bytes */
  compressedSize: number;
  /** Percentual de redução, ex: 72 = 72% menor */
  reductionPct: number;
}

/**
 * Converte qualquer imagem (JPEG, PNG, GIF, AVIF, TIFF, HEIC…) para WebP
 * com qualidade configurável. Retorna o buffer comprimido e metadados.
 *
 * @param input  Buffer da imagem original (base64 já decodificado)
 * @param quality  Qualidade WebP de 1–100 (padrão: 82)
 * @param maxWidth  Largura máxima em pixels — redimensiona proporcionalmente se maior (padrão: 1200)
 */
export async function compressToWebP(
  input: Buffer,
  quality = 82,
  maxWidth = 1200
): Promise<CompressResult> {
  const originalSize = input.length;

  const compressed = await sharp(input)
    .resize({ width: maxWidth, withoutEnlargement: true }) // nunca amplia
    .webp({ quality, effort: 4 })                          // effort 4 = bom equilíbrio velocidade/tamanho
    .toBuffer();

  const compressedSize = compressed.length;
  const reductionPct = Math.round((1 - compressedSize / originalSize) * 100);

  return {
    buffer: compressed,
    mimeType: "image/webp",
    ext: "webp",
    originalSize,
    compressedSize,
    reductionPct,
  };
}
