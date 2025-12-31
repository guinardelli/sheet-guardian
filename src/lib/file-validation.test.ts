import { describe, expect, it } from 'vitest';
import { getMagicBytes, hasZipMagicBytes, isAllowedMimeType } from '@/lib/file-validation';

describe('file-validation', () => {
  it('accepts allowed mime types and generic fallbacks', () => {
    const allowed = new File(['data'], 'file.xlsm', {
      type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    });
    const octet = new File(['data'], 'file.xlsm', { type: 'application/octet-stream' });
    const empty = new File(['data'], 'file.xlsm', { type: '' });
    const invalid = new File(['data'], 'file.xlsm', { type: 'image/png' });

    expect(isAllowedMimeType(allowed)).toBe(true);
    expect(isAllowedMimeType(octet)).toBe(true);
    expect(isAllowedMimeType(empty)).toBe(true);
    expect(isAllowedMimeType(invalid)).toBe(false);
  });

  it('reads magic bytes from a blob', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x05]);
    const blob = new Blob([bytes]);
    const result = await getMagicBytes(blob, 4);
    expect(Array.from(result)).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('validates zip magic bytes', () => {
    expect(hasZipMagicBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    expect(hasZipMagicBytes(new Uint8Array([0x50, 0x4b, 0x03]))).toBe(false);
    expect(hasZipMagicBytes(new Uint8Array([0x00, 0x11, 0x22, 0x33]))).toBe(false);
  });
});
