import { useState, useCallback } from 'react';
import { Play, RotateCcw, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
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
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';

export function ExcelBlocker() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<ProcessingResult | null>(null);

  const { user } = useAuth();
  const { subscription, canProcessSheet, incrementUsage } = useSubscription();
  const navigate = useNavigate();

  const handleFileSelect = useCallback((file: File) => {
    if (!user) {
      toast.error('Login necessário', {
        description: 'Faça login para processar planilhas.'
      });
      navigate('/auth');
      return;
    }

    const fileSizeKB = file.size / 1024;
    const { allowed, reason } = canProcessSheet(fileSizeKB);
    
    if (!allowed) {
      toast.error('Limite atingido', {
        description: reason
      });
      return;
    }

    setSelectedFile(file);
    setOriginalFile(file);
    setResult(null);
    setLogs([]);
    setProgress(0);
  }, [user, canProcessSheet, navigate]);

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
    if (!selectedFile || !user) return;

    const fileSizeKB = selectedFile.size / 1024;
    const { allowed, reason } = canProcessSheet(fileSizeKB);
    
    if (!allowed) {
      toast.error('Limite atingido', {
        description: reason
      });
      return;
    }

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
      await incrementUsage();
      
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
  }, [selectedFile, user, canProcessSheet, handleLog, incrementUsage]);

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

  const planLimits = subscription ? PLAN_LIMITS[subscription.plan] : null;

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-8">
      {/* Header */}
      <header className="flex items-center justify-center gap-4">
        <ExcelIcon className="w-10 h-10 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">
          Bloqueador de Planilhas Excel
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex flex-col gap-8">
        {/* Title Section */}
        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Bloqueador de Planilhas
          </h2>
          <p className="text-muted-foreground text-base">
            Selecione um arquivo Excel (.xlsm), inicie o processamento e acompanhe o status no log.
          </p>
        </div>

        {/* Auth Alert */}
        {!user && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Login necessário</AlertTitle>
            <AlertDescription>
              <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/auth')}>
                Faça login
              </Button>
              {' '}para processar planilhas.
            </AlertDescription>
          </Alert>
        )}

        {/* Usage Info */}
        {user && subscription && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                {planLimits?.sheetsPerMonth !== null && (
                  <div>
                    <span className="text-muted-foreground">Uso mensal: </span>
                    <span className="font-medium">
                      {subscription.sheets_used_month}/{planLimits.sheetsPerMonth}
                    </span>
                  </div>
                )}
                {planLimits?.sheetsPerWeek !== null && (
                  <div>
                    <span className="text-muted-foreground">Uso semanal: </span>
                    <span className="font-medium">
                      {subscription.sheets_used_today}/{planLimits.sheetsPerWeek}
                    </span>
                  </div>
                )}
                {planLimits?.maxFileSizeMB !== null && (
                  <div>
                    <span className="text-muted-foreground">Tamanho máximo: </span>
                    <span className="font-medium">{planLimits.maxFileSizeMB} MB</span>
                  </div>
                )}
                {subscription.plan === 'premium' && (
                  <div className="text-primary font-medium">✨ Sem limitações</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* File Dropzone */}
        <FileDropzone
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          onClearFile={handleClearFile}
          disabled={isProcessing || !user}
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
            disabled={!selectedFile || isProcessing || !user}
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
