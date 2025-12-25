import { useCallback, useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MAX_FILE_SIZE_BYTES, LARGE_FILE_WARNING_BYTES } from '@/lib/constants';
import { toast } from 'sonner';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  disabled?: boolean;
}

export function FileDropzone({
  onFileSelect,
  selectedFile,
  onClearFile,
  disabled
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set isDragging to false if we're actually leaving the dropzone
    // This prevents flickering when dragging over child elements
    if (dropzoneRef.current && !dropzoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const validateAndSelectFile = useCallback((file: File): boolean => {
    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.xlsm')) {
      toast.error('Tipo de arquivo inválido', {
        description: 'Apenas arquivos .xlsm são aceitos.'
      });
      return false;
    }

    // Validate file is not empty
    if (file.size === 0) {
      toast.error('Arquivo vazio', {
        description: 'O arquivo selecionado está vazio.'
      });
      return false;
    }

    // Validate file size (hard limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('Arquivo muito grande', {
        description: `O tamanho máximo permitido é ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`
      });
      return false;
    }

    // Warn about large files
    if (file.size > LARGE_FILE_WARNING_BYTES) {
      toast.warning('Arquivo grande detectado', {
        description: 'O processamento pode levar mais tempo. Por favor, aguarde.'
      });
    }

    onFileSelect(file);
    return true;
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  }, [validateAndSelectFile, disabled]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSelectFile(files[0]);
    }
    // Always reset input value to allow re-selecting the same file
    e.target.value = '';
  }, [validateAndSelectFile]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div
      ref={dropzoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center gap-6 rounded-2xl border-2 border-dashed px-6 py-16 transition-all duration-200',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.02] shadow-soft-lg'
          : 'border-border/70 bg-card/30',
        !isDragging && !disabled && 'hover:border-primary/50 hover:bg-primary/5 hover:shadow-soft',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {selectedFile ? (
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 shadow-soft">
            <FileSpreadsheet className="w-10 h-10 text-primary" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-foreground font-bold text-lg tracking-tight">{selectedFile.name}</p>
            <p className="text-muted-foreground text-sm font-medium">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFile}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4 mr-2" />
              Remover arquivo
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-muted/80">
            <Upload className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="flex flex-col items-center gap-2.5 max-w-md text-center">
            <p className="text-foreground text-lg font-bold tracking-tight">
              Arraste e solte seu arquivo Excel aqui
            </p>
            <p className="text-muted-foreground text-sm">
              Ou clique para selecionar um arquivo .xlsm
            </p>
          </div>
          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsm"
              onChange={handleFileInput}
              className="hidden"
              disabled={disabled}
            />
            <Button
              variant="secondary"
              className="pointer-events-none h-10 px-6"
              disabled={disabled}
            >
              Selecionar Arquivo
            </Button>
          </label>
        </>
      )}
    </div>
  );
}
