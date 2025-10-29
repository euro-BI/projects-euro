/**
 * Service para comunicação com os webhooks do n8n para atualização do Power BI
 */

// URLs dos webhooks
const WEBHOOK_BASE_URL = 'https://n8n-n8n.ffder9.easypanel.host/webhook';
const UPDATE_WEBHOOK_URL = `${WEBHOOK_BASE_URL}/atualizar-bi`;
const STATUS_WEBHOOK_URL = `${WEBHOOK_BASE_URL}/status-bi`;

// Tipos para as respostas dos webhooks
export interface PowerBiUpdateResponse {
  success: boolean;
  message: string;
  status: 'iniciado' | 'em_andamento';
  estimatedTime?: string;
  timestamp: string;
}

export interface PowerBiStatusResponse {
  success: boolean;
  message: string;
  status: 'em_andamento' | 'disponivel';
  emAndamento: boolean;
  timestamp: string;
}

export interface PowerBiError {
  success: false;
  message: string;
  error?: string;
}

/**
 * Inicia a atualização do Power BI
 * @returns Promise com a resposta do webhook
 */
export async function startPowerBiUpdate(): Promise<PowerBiUpdateResponse> {
  try {
    const response = await fetch(UPDATE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Timeout de 30 segundos para a requisição inicial
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      if (response.status === 409) {
        // Já existe atualização em andamento
        const errorData = await response.json();
        throw new Error(errorData.message || 'Já existe uma atualização em andamento');
      }
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data: PowerBiUpdateResponse = await response.json();
    
    // Validar estrutura da resposta
    if (!data.success || !data.status || !data.timestamp) {
      throw new Error('Resposta inválida do servidor');
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Timeout: O servidor demorou muito para responder');
      }
      throw error;
    }
    throw new Error('Erro desconhecido ao iniciar atualização');
  }
}

/**
 * Consulta o status da atualização do Power BI
 * @returns Promise com o status atual
 */
export async function getPowerBiStatus(): Promise<PowerBiStatusResponse> {
  try {
    const response = await fetch(STATUS_WEBHOOK_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Timeout de 15 segundos para consultas de status
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data: PowerBiStatusResponse = await response.json();
    
    // Validar estrutura da resposta
    if (!data.success || !data.status || typeof data.emAndamento !== 'boolean' || !data.timestamp) {
      throw new Error('Resposta inválida do servidor');
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Timeout: O servidor demorou muito para responder');
      }
      throw error;
    }
    throw new Error('Erro desconhecido ao consultar status');
  }
}

/**
 * Hook personalizado para gerenciar o polling do status do Power BI
 */
export class PowerBiPollingManager {
  private intervalId: NodeJS.Timeout | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private isPolling = false;
  
  // Timeout de 10 minutos (600000ms)
  private readonly POLLING_TIMEOUT = 10 * 60 * 1000;
  // Intervalo de 10 segundos (10000ms)
  private readonly POLLING_INTERVAL = 10 * 1000;

  /**
   * Inicia o polling do status
   * @param onStatusUpdate Callback chamado a cada atualização de status
   * @param onComplete Callback chamado quando a atualização é concluída
   * @param onError Callback chamado em caso de erro
   * @param onTimeout Callback chamado em caso de timeout
   */
  startPolling(
    onStatusUpdate: (status: PowerBiStatusResponse) => void,
    onComplete: () => void,
    onError: (error: string) => void,
    onTimeout: () => void
  ): void {
    if (this.isPolling) {
      console.warn('Polling já está em andamento');
      return;
    }

    this.isPolling = true;

    // Configurar timeout de 10 minutos
    this.timeoutId = setTimeout(() => {
      this.stopPolling();
      onTimeout();
    }, this.POLLING_TIMEOUT);

    // Função para fazer a consulta de status
    const checkStatus = async () => {
      try {
        const status = await getPowerBiStatus();
        onStatusUpdate(status);

        // Se não está mais em andamento, parar o polling e chamar onComplete
        if (!status.emAndamento) {
          this.stopPolling();
          onComplete();
        }
      } catch (error) {
        this.stopPolling();
        onError(error instanceof Error ? error.message : 'Erro desconhecido');
      }
    };

    // Fazer a primeira consulta imediatamente
    checkStatus();

    // Configurar intervalo para consultas subsequentes
    this.intervalId = setInterval(checkStatus, this.POLLING_INTERVAL);
  }

  /**
   * Para o polling
   */
  stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.isPolling = false;
  }

  /**
   * Verifica se o polling está ativo
   */
  get isActive(): boolean {
    return this.isPolling;
  }

  /**
   * Limpa todos os timers (para ser chamado no cleanup do componente)
   */
  cleanup(): void {
    this.stopPolling();
  }
}