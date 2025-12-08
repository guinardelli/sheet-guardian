import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.xlsm')) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect, disabled]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
    e.target.value = '';
  }, [onFileSelect]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center gap-6 rounded-xl border-2 border-dashed px-6 py-14 transition-all duration-200',
        isDragging 
          ? 'border-primary bg-primary/5' 
          : 'border-border bg-card/50',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && !selectedFile && 'hover:border-primary/50 hover:bg-card/80'
      )}
    >
      {selectedFile ? (
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-foreground font-bold text-lg">{selectedFile.name}</p>
            <p className="text-muted-foreground text-sm">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFile}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="w-4 h-4 mr-2" />
              Remover arquivo
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
            <Upload className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="flex flex-col items-center gap-2 max-w-md text-center">
            <p className="text-foreground text-lg font-bold">
              Arraste e solte seu arquivo Excel aqui
            </p>
            <p className="text-muted-foreground text-sm">
              Ou clique para selecionar um arquivo .xlsm
            </p>
          </div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsm"
              onChange={handleFileInput}
              className="hidden"
              disabled={disabled}
            />
            <Button
              variant="secondary"
              className="pointer-events-none"
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
