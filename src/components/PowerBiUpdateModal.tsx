import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { Loader2, CheckCircle2, AlertCircle, BarChart3 } from "lucide-react";
import { 
  PowerBiPollingManager, 
  PowerBiStatusResponse,
  startPowerBiUpdate 
} from "@/services/powerBiService";

interface PowerBiUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateComplete: () => void;
}

type ModalState = 
  | 'initiating'     // Iniciando atualização
  | 'updating'       // Em andamento
  | 'success'        // Concluído com sucesso
  | 'error'          // Erro
  | 'timeout'        // Timeout
  | 'already_running'; // Já em andamento

export function PowerBiUpdateModal({ isOpen, onClose, onUpdateComplete }: PowerBiUpdateModalProps) {
  const [modalState, setModalState] = useState<ModalState>('initiating');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState<string>('2 minutos');
  const [currentStatus, setCurrentStatus] = useState<PowerBiStatusResponse | null>(null);
  
  // Refs para gerenciar timers e polling
  const pollingManagerRef = useRef<PowerBiPollingManager | null>(null);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Função para formatar o status para exibição
  const formatStatus = (status: string): string => {
    switch (status) {
      case 'em_andamento':
        return 'Em andamento';
      case 'disponivel':
        return 'Disponível';
      case 'iniciado':
        return 'Iniciado';
      default:
        return status;
    }
  };

  // Limpar timers ao desmontar o componente
  useEffect(() => {
    return () => {
      if (pollingManagerRef.current) {
        pollingManagerRef.current.cleanup();
      }
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // Iniciar atualização quando o modal abrir
  useEffect(() => {
    if (isOpen && modalState === 'initiating') {
      handleStartUpdate();
    }
  }, [isOpen]);

  const handleStartUpdate = async () => {
    try {
      setModalState('initiating');
      setErrorMessage('');

      // Chamar webhook para iniciar atualização
      const response = await startPowerBiUpdate();
      
      if (response.success) {
        setEstimatedTime(response.estimatedTime || '2 minutos');
        setModalState('updating');
        startPolling();
      } else {
        setErrorMessage(response.message);
        setModalState('error');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Já existe uma atualização em andamento')) {
          setModalState('already_running');
          setErrorMessage('Já existe uma atualização em andamento. Aguarde a conclusão.');
        } else {
          setErrorMessage(error.message);
          setModalState('error');
        }
      } else {
        setErrorMessage('Erro desconhecido ao iniciar atualização');
        setModalState('error');
      }
    }
  };

  const startPolling = () => {
    // Criar nova instância do polling manager
    pollingManagerRef.current = new PowerBiPollingManager();

    pollingManagerRef.current.startPolling(
      // onStatusUpdate
      (status: PowerBiStatusResponse) => {
        setCurrentStatus(status);
        console.log('Status atualizado:', status);
      },
      // onComplete
      () => {
        setModalState('success');
        onUpdateComplete();
        
        // Fechar modal automaticamente após 3 segundos
        successTimeoutRef.current = setTimeout(() => {
          handleClose();
        }, 3000);
      },
      // onError
      (error: string) => {
        setErrorMessage(error);
        setModalState('error');
      },
      // onTimeout
      () => {
        setErrorMessage('Timeout: A atualização demorou mais de 10 minutos para ser concluída');
        setModalState('timeout');
      }
    );
  };

  const handleClose = () => {
    // Limpar polling se estiver ativo
    if (pollingManagerRef.current) {
      pollingManagerRef.current.cleanup();
    }

    // Limpar timeout de sucesso
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }

    // Resetar estado para próxima abertura
    setModalState('initiating');
    setErrorMessage('');
    setCurrentStatus(null);
    
    onClose();
  };

  const handleRetry = () => {
    setModalState('initiating');
    setErrorMessage('');
    setCurrentStatus(null);
    handleStartUpdate();
  };

  const getModalContent = () => {
    switch (modalState) {
      case 'initiating':
        return {
          icon: <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />,
          title: 'Iniciando Atualização',
          message: 'Iniciando atualização do Power BI...',
          showProgress: true,
          showRetry: false,
        };

      case 'updating':
        return {
          icon: <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />,
          title: 'Atualizando Power BI',
          message: 'Atualizando dados do Power BI...',
          showProgress: true,
          showRetry: false,
        };

      case 'success':
        return {
          icon: <CheckCircle2 className="w-8 h-8 text-green-400" />,
          title: 'Atualização Concluída',
          message: 'Atualização concluída com sucesso!',
          showProgress: false,
          showRetry: false,
        };

      case 'error':
        return {
          icon: <AlertCircle className="w-8 h-8 text-red-400" />,
          title: 'Erro na Atualização',
          message: errorMessage || 'Erro ao conectar. Tente novamente.',
          showProgress: false,
          showRetry: true,
        };

      case 'timeout':
        return {
          icon: <AlertCircle className="w-8 h-8 text-primary" />,
          title: 'Timeout',
          message: errorMessage || 'A atualização demorou mais que o esperado',
          showProgress: false,
          showRetry: true,
        };

      case 'already_running':
        return {
          icon: <AlertCircle className="w-8 h-8 text-primary" />,
          title: 'Atualização em Andamento',
          message: 'Já existe uma atualização em andamento. Aguarde a conclusão.',
          showProgress: false,
          showRetry: false,
        };

      default:
        return {
          icon: <BarChart3 className="w-8 h-8 text-blue-400" />,
          title: 'Power BI',
          message: 'Preparando atualização...',
          showProgress: false,
          showRetry: false,
        };
    }
  };

  const content = getModalContent();

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            {content.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Ícone e mensagem principal */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex items-center justify-center">
              {content.icon}
            </div>
            
            <div className="space-y-2">
              <p className="text-lg font-medium">{content.message}</p>
              
              {modalState === 'updating' && (
                <p className="text-sm text-muted-foreground">
                  Tempo estimado: {estimatedTime}
                </p>
              )}

              {modalState === 'success' && (
                <p className="text-sm text-muted-foreground">
                  Fechando automaticamente em 3 segundos...
                </p>
              )}
            </div>
          </div>

          {/* Barra de progresso para estados de carregamento */}
          {content.showProgress && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Processando dados...
              </p>
            </div>
          )}

          {/* Informações de status durante polling */}
          {currentStatus && modalState === 'updating' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p><strong>Status:</strong> {formatStatus(currentStatus.status)}</p>
                  <p><strong>Última atualização:</strong> {new Date(currentStatus.timestamp).toLocaleTimeString()}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Mensagem de erro */}
          {(modalState === 'error' || modalState === 'timeout') && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Botões de ação */}
          <div className="flex justify-end gap-2">
            {content.showRetry && (
              <Button onClick={handleRetry}>
                <Loader2 className="w-4 h-4 mr-2" />
                Tentar Novamente
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}