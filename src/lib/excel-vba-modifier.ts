import JSZip from 'jszip';

const VBA_FILENAME = 'xl/vbaProject.bin';

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

// Binary patterns to search for (matching Python implementation)
const BINARY_PATTERNS = [
  { prefix: [67, 77, 71, 61, 34], name: 'CMG' },  // CMG="
  { prefix: [68, 80, 66, 61, 34], name: 'DPB' },  // DPB="
  { prefix: [71, 67, 61, 34], name: 'GC' }        // GC="
];

const QUOTE_BYTE = 34; // "
const F_BYTE = 70;     // F

function modifyVbaContent(content: Uint8Array): { modified: Uint8Array; patternsFound: number } {
  // Work directly with bytes to avoid encoding issues
  const result = new Uint8Array(content);
  let patternsFound = 0;
  
  for (const pattern of BINARY_PATTERNS) {
    let i = 0;
    while (i < result.length - pattern.prefix.length) {
      // Check if we found the pattern prefix
      let found = true;
      for (let j = 0; j < pattern.prefix.length; j++) {
        if (result[i + j] !== pattern.prefix[j]) {
          found = false;
          break;
        }
      }
      
      if (found) {
        // Find the closing quote
        const valueStart = i + pattern.prefix.length;
        let valueEnd = valueStart;
        
        while (valueEnd < result.length && result[valueEnd] !== QUOTE_BYTE) {
          valueEnd++;
        }
        
        if (valueEnd < result.length) {
          // Replace the value with 'F's (same length)
          for (let k = valueStart; k < valueEnd; k++) {
            result[k] = F_BYTE;
          }
          patternsFound++;
          i = valueEnd + 1;
          continue;
        }
      }
      i++;
    }
  }

  return {
    modified: result,
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
