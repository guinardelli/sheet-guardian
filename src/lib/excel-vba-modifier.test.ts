import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { processExcelFile } from '@/lib/excel-vba-modifier';

const createFileLike = (bytes: Uint8Array, name: string) => {
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as File;
};

const createXlsmFile = async (options?: {
  name?: string;
  includeVba?: boolean;
  vbaContent?: Uint8Array;
}) => {
  const zip = new JSZip();
  if (options?.includeVba !== false) {
    const content = options?.vbaContent ?? new Uint8Array(160);
    zip.file('xl/vbaProject.bin', content);
  } else {
    zip.file('xl/workbook.xml', '<workbook />');
  }

  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return createFileLike(bytes, options?.name ?? 'test.xlsm');
};

const makeVbaContent = (patterns: string[]) => {
  const content = new Uint8Array(200);
  let offset = 0;
  for (const pattern of patterns) {
    const bytes = new TextEncoder().encode(pattern);
    content.set(bytes, offset);
    offset += bytes.length + 4;
  }
  return content;
};

describe('processExcelFile', () => {
  it('rejects non-xlsm files', async () => {
    const file = createFileLike(new TextEncoder().encode('data'), 'invalid.xlsx');
    const result = await processExcelFile(file, () => {}, () => {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch('Tipo de arquivo');
  });

  it('rejects empty files', async () => {
    const file = createFileLike(new Uint8Array(), 'empty.xlsm');
    const result = await processExcelFile(file, () => {}, () => {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch('arquivo');
  });

  it('rejects corrupted zip files', async () => {
    const file = createFileLike(new Uint8Array([1, 2, 3]), 'corrupt.xlsm');
    const result = await processExcelFile(file, () => {}, () => {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch('corrompido');
  });

  it('handles .xlsm without VBA project', async () => {
    const file = await createXlsmFile({ includeVba: false });
    const result = await processExcelFile(file, () => {}, () => {});
    expect(result.success).toBe(true);
    expect(result.vbaExists).toBe(false);
    expect(result.patternsModified).toBe(0);
    expect(result.shouldCountUsage).toBe(false);
  });

  it('does not count usage when no patterns are modified', async () => {
    const content = makeVbaContent(['NOPE="ABC"']);
    const file = await createXlsmFile({ vbaContent: content });
    const result = await processExcelFile(file, () => {}, () => {});
    expect(result.success).toBe(true);
    expect(result.vbaExists).toBe(true);
    expect(result.patternsModified).toBe(0);
    expect(result.shouldCountUsage).toBe(false);
  });

  it('modifies multiple VBA protection patterns', async () => {
    const content = makeVbaContent(['CMG="ABC"', 'DPB="XYZ"', 'GC="Q"']);
    const file = await createXlsmFile({ vbaContent: content });
    const result = await processExcelFile(file, () => {}, () => {});
    expect(result.success).toBe(true);
    expect(result.patternsModified).toBe(3);
    expect(result.shouldCountUsage).toBe(true);
  });

  it('processes large VBA payloads (>50MB)', async () => {
    const largeSize = 52 * 1024 * 1024;
    const content = new Uint8Array(largeSize);
    const pattern = new TextEncoder().encode('CMG="ABC"');
    content.set(pattern, 0);
    const file = await createXlsmFile({ vbaContent: content });
    const result = await processExcelFile(file, () => {}, () => {});
    expect(result.success).toBe(true);
    expect(result.modifiedFile).toBeTruthy();
    expect(result.patternsModified).toBe(1);
  }, 20000);

  it('returns a valid zip after modification', async () => {
    const content = makeVbaContent(['CMG="ABC"']);
    const file = await createXlsmFile({ vbaContent: content });
    const result = await processExcelFile(file, () => {}, () => {});
    expect(result.success).toBe(true);
    expect(result.modifiedFile).not.toBeNull();
    const zip = await JSZip.loadAsync(result.modifiedFile as Blob);
    expect(zip.file('xl/vbaProject.bin')).not.toBeNull();
  });

  it('handles pattern at buffer boundary', async () => {
    const pattern = 'GC="Z"';
    const content = new Uint8Array(120);
    const bytes = new TextEncoder().encode(pattern);
    content.set(bytes, content.length - bytes.length);
    const file = await createXlsmFile({ vbaContent: content });
    const result = await processExcelFile(file, () => {}, () => {});
    expect(result.success).toBe(true);
    expect(result.patternsModified).toBe(1);
    expect(result.shouldCountUsage).toBe(true);
  });
});
