import JSZip from 'jszip';

const VBA_FILENAME = 'xl/vbaProject.bin';

// VBA protection patterns - matching the Python implementation
const PATTERNS = [
  /CMG="([^"]*)"/g,  // Project protection key
  /DPB="([^"]*)"/g,  // Binary protection data
  /GC="([^"]*)"/g    // General verification code
];

export interface ProcessingResult {
  success: boolean;
  modifiedFile: Blob | null;
  originalFileName: string;
  newFileName: string;
  vbaExists: boolean;
  patternsModified: number;
  originalSize: number;
  modifiedSize: number;
  error?: string;
}

export interface LogEntry {
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

function modifyVbaContent(content: Uint8Array): { modified: Uint8Array; patternsFound: number } {
  let textContent = bytesToText(content);
  let patternsFound = 0;

  for (const pattern of PATTERNS) {
    // Reset the regex lastIndex
    pattern.lastIndex = 0;
    
    textContent = textContent.replace(pattern, (match, group) => {
      patternsFound++;
      const replacement = 'F'.repeat(group.length);
      const patternName = match.split('=')[0];
      return `${patternName}="${replacement}"`;
    });
  }

  return {
    modified: textToBytes(textContent),
    patternsFound
  };
}

export async function processExcelFile(
  file: File,
  onLog: (entry: LogEntry) => void,
  onProgress: (progress: number) => void
): Promise<ProcessingResult> {
  const log = (message: string, type: LogEntry['type'] = 'info') => {
    onLog({ timestamp: new Date(), message, type });
  };

  try {
    log('🚀 Iniciando processo de modificação...', 'info');
    onProgress(5);

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.xlsm')) {
      throw new Error('Tipo de arquivo inválido. Apenas arquivos .xlsm são aceitos.');
    }

    log('📦 Lendo arquivo Excel...', 'info');
    onProgress(10);

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    log('✅ Arquivo lido com sucesso', 'success');
    onProgress(30);

    // Check for VBA project
    const vbaFile = zip.file(VBA_FILENAME);
    const vbaExists = vbaFile !== null;

    if (!vbaExists) {
      log('⚠️ AVISO: Nenhum arquivo VBA encontrado no Excel!', 'warning');
      
      // Return the file as-is
      const modifiedBlob = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
      const baseName = file.name.replace(/\.xlsm$/i, '');
      
      return {
        success: true,
        modifiedFile: modifiedBlob,
        originalFileName: file.name,
        newFileName: `${baseName}_${timestamp}.xlsm`,
        vbaExists: false,
        patternsModified: 0,
        originalSize: file.size,
        modifiedSize: modifiedBlob.size
      };
    }

    log('🔧 Modificando arquivo VBA...', 'info');
    onProgress(50);

    // Read and modify VBA content
    const vbaContent = await vbaFile.async('uint8array');
    const { modified: modifiedVba, patternsFound } = modifyVbaContent(vbaContent);

    if (patternsFound > 0) {
      log(`✅ ${patternsFound} padrão(ões) de proteção modificado(s)`, 'success');
      zip.file(VBA_FILENAME, modifiedVba);
    } else {
      log('ℹ️ VBA encontrado, mas nenhum padrão de proteção foi modificado', 'warning');
    }

    onProgress(70);

    // Generate the modified file
    log('📝 Gerando arquivo modificado...', 'info');
    const modifiedBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    onProgress(90);

    // Generate new filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const baseName = file.name.replace(/\.xlsm$/i, '');
    const newFileName = `${baseName}_${timestamp}.xlsm`;

    log(`✅ Processo concluído com sucesso!`, 'success');
    log(`📁 Arquivo gerado: ${newFileName}`, 'info');
    onProgress(100);

    return {
      success: true,
      modifiedFile: modifiedBlob,
      originalFileName: file.name,
      newFileName,
      vbaExists: true,
      patternsModified: patternsFound,
      originalSize: file.size,
      modifiedSize: modifiedBlob.size
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    log(`❌ Erro: ${errorMessage}`, 'error');
    
    return {
      success: false,
      modifiedFile: null,
      originalFileName: file.name,
      newFileName: '',
      vbaExists: false,
      patternsModified: 0,
      originalSize: file.size,
      modifiedSize: 0,
      error: errorMessage
    };
  }
}

export function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
