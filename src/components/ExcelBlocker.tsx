import { useState, useCallback } from 'react';
import { Play, RotateCcw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileDropzone } from './FileDropzone';
import { ProcessingLog } from './ProcessingLog';
import { StatisticsCard } from './StatisticsCard';
import { ExcelIcon } from './ExcelIcon';
import { 
  processExcelFile, 
  downloadFile, 
  LogEntry, 
  ProcessingResult 
} from '@/lib/excel-vba-modifier';
import { toast } from 'sonner';

export function ExcelBlocker() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<ProcessingResult | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setOriginalFile(file);
    setResult(null);
    setLogs([]);
    setProgress(0);
  }, []);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setOriginalFile(null);
    setResult(null);
    setLogs([]);
    setProgress(0);
  }, []);

  const handleLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
  }, []);

  const handleProcess = useCallback(async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setLogs([]);
    setProgress(0);
    setResult(null);

    const processingResult = await processExcelFile(
      selectedFile,
      handleLog,
      setProgress
    );

    setResult(processingResult);
    setIsProcessing(false);

    if (processingResult.success && processingResult.modifiedFile) {
      toast.success('Arquivo processado com sucesso!', {
        description: `${processingResult.patternsModified} padrão(ões) modificado(s)`,
        action: {
          label: 'Baixar',
          onClick: () => downloadFile(
            processingResult.modifiedFile!,
            processingResult.newFileName
          )
        }
      });
    } else if (processingResult.error) {
      toast.error('Erro ao processar arquivo', {
        description: processingResult.error
      });
    }
  }, [selectedFile, handleLog]);

  const handleDownload = useCallback(() => {
    if (result?.modifiedFile) {
      downloadFile(result.modifiedFile, result.newFileName);
      toast.success('Download iniciado!');
    }
  }, [result]);

  const handleRestore = useCallback(() => {
    if (originalFile) {
      downloadFile(originalFile, originalFile.name);
      toast.info('Arquivo original baixado');
    }
  }, [originalFile]);

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-8">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <ExcelIcon className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold text-foreground">
            Bloqueador de Planilhas Excel
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col gap-8">
        {/* Title Section */}
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Bloqueador de Planilhas
          </h2>
          <p className="text-muted-foreground text-base">
            Selecione um arquivo Excel (.xlsm), inicie o processamento e acompanhe o status no log.
          </p>
        </div>

        {/* File Dropzone */}
        <FileDropzone
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          onClearFile={handleClearFile}
          disabled={isProcessing}
        />

        {/* Progress Bar */}
        {isProcessing && (
          <div className="flex flex-col gap-2 animate-fade-in">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Processando...</span>
              <span className="text-foreground font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            onClick={handleProcess}
            disabled={!selectedFile || isProcessing}
            className="min-w-[200px]"
          >
            <Play className="w-4 h-4 mr-2" />
            {isProcessing ? 'Processando...' : 'Iniciar Processamento'}
          </Button>

          {result?.success && result.modifiedFile && (
            <Button
              size="lg"
              variant="outline"
              onClick={handleDownload}
              className="min-w-[200px] animate-fade-in"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Arquivo
            </Button>
          )}

          {originalFile && result && (
            <Button
              size="lg"
              variant="secondary"
              onClick={handleRestore}
              className="min-w-[200px]"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restaurar Original
            </Button>
          )}
        </div>

        {/* Statistics */}
        <StatisticsCard result={result} />

        {/* Processing Log */}
        <ProcessingLog logs={logs} />
      </main>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-border mt-4">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Bloqueador de Planilhas. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
