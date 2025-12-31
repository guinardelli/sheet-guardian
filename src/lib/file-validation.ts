import { ALLOWED_MIME_TYPES } from '@/lib/constants';

const ZIP_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04];
const OCTET_STREAM = 'application/octet-stream';
const ALLOWED_MIME_TYPES_LOWER = ALLOWED_MIME_TYPES.map((type) => type.toLowerCase());

export const isAllowedMimeType = (file: File): boolean => {
  const mimeType = file.type?.toLowerCase?.() ?? '';
  if (!mimeType || mimeType === OCTET_STREAM) {
    return true;
  }
  return ALLOWED_MIME_TYPES_LOWER.includes(mimeType);
};

export const getMagicBytes = async (blob: Blob, length = 4): Promise<Uint8Array> => {
  const slice = blob.slice(0, length);
  const buffer = typeof slice.arrayBuffer === 'function'
    ? await slice.arrayBuffer()
    : await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
        reader.readAsArrayBuffer(slice);
      });
  return new Uint8Array(buffer);
};

export const hasZipMagicBytes = (bytes: Uint8Array): boolean => {
  if (bytes.length < ZIP_MAGIC_BYTES.length) {
    return false;
  }
  return (
    bytes[0] === ZIP_MAGIC_BYTES[0]
    && bytes[1] === ZIP_MAGIC_BYTES[1]
    && bytes[2] === ZIP_MAGIC_BYTES[2]
    && bytes[3] === ZIP_MAGIC_BYTES[3]
  );
};
