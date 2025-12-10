import { useState, useCallback, useEffect } from 'react';
import { Play, RotateCcw, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { FileDropzone } from '@/components/FileDropzone';
import { ProcessingLog } from '@/components/ProcessingLog';
import { StatisticsCard } from '@/components/StatisticsCard';
import { ExcelIcon } from '@/components/ExcelIcon';
import { Header } from '@/components/Header';
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

const PROCESSING_MESSAGES = [
  'Analisando arquivo...',
  'Verificando estrutura VBA...',
  'Processando macros...',
  'Aplicando modificações...',
  'Finalizando...',
];

const Dashboard = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { subscription, canProcessSheet, incrementUsage } = useSubscription();
  const navigate = useNavigate();

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Cinematic progress animation
  useEffect(() => {
    if (!isProcessing || processingComplete) return;

    const duration = 4000; // 4 seconds
    const interval = 50;
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newProgress = Math.min(Math.floor((currentStep / steps) * 95), 95);
      setDisplayProgress(newProgress);

      // Update message based on progress
      const messageIndex = Math.min(
        Math.floor((newProgress / 100) * PROCESSING_MESSAGES.length),
        PROCESSING_MESSAGES.length - 1
      );
      setProcessingMessage(PROCESSING_MESSAGES[messageIndex]);

      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isProcessing, processingComplete]);

  // Complete the progress when processing is done
  useEffect(() => {
    if (processingComplete && result) {
      setDisplayProgress(100);
      setProcessingMessage('Concluído!');
    }
  }, [processingComplete, result]);

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
    setDisplayProgress(0);
    setProcessingComplete(false);
  }, [user, canProcessSheet, navigate]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setOriginalFile(null);
    setResult(null);
    setLogs([]);
    setProgress(0);
    setDisplayProgress(0);
    setProcessingComplete(false);
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
    setDisplayProgress(0);
    setResult(null);
    setProcessingComplete(false);

    const processingResult = await processExcelFile(
      selectedFile,
      handleLog,
      setProgress
    );

    // Wait for the cinematic animation to catch up
    await new Promise(resolve => setTimeout(resolve, 4500));

    setResult(processingResult);
    setProcessingComplete(true);
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="flex flex-col w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-8">
        {/* Header */}
        <header className="flex items-center justify-center gap-4">
          <ExcelIcon className="w-10 h-10 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            Bloqueador de Planilhas Excel
          </h1>
        </header>

        {/* Title Section */}
        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Bloqueador de Planilhas
          </h2>
          <p className="text-muted-foreground text-base">
            Selecione um arquivo Excel (.xlsm), inicie o processamento e acompanhe o status no log.
          </p>
        </div>

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

        {/* Cinematic Progress Bar */}
        {isProcessing && (
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">{processingMessage}</span>
                  <span className="text-sm font-bold text-primary">{displayProgress}%</span>
                </div>
                <Progress value={displayProgress} className="h-3" />
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <div className="animate-pulse w-2 h-2 bg-primary rounded-full"></div>
                    Processando seu arquivo...
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
          <Button
            size="lg"
            onClick={handleProcess}
            disabled={!selectedFile || isProcessing || !user}
            className="w-full sm:w-auto sm:min-w-[200px]"
          >
            <Play className="w-4 h-4 mr-2" />
            {isProcessing ? 'Processando...' : 'Iniciar Processamento'}
          </Button>

          {result?.success && result.modifiedFile && processingComplete && (
            <Button
              size="lg"
              variant="outline"
              onClick={handleDownload}
              className="w-full sm:w-auto sm:min-w-[200px] animate-fade-in"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Arquivo
            </Button>
          )}

          {originalFile && result && processingComplete && (
            <Button
              size="lg"
              variant="secondary"
              onClick={handleRestore}
              className="w-full sm:w-auto sm:min-w-[200px]"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restaurar Original
            </Button>
          )}
        </div>

        {/* Statistics */}
        {processingComplete && <StatisticsCard result={result} />}

        {/* Processing Log */}
        <ProcessingLog logs={logs} />

        {/* Footer */}
        <footer className="text-center py-6 border-t border-border mt-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Bloqueador de Planilhas. Todos os direitos reservados.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
