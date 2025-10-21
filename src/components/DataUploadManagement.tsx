import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from 'xlsx';

export function DataUploadManagement() {
  const { user } = useAuth();
  
  // N8N Upload states
  const [selectedUploadName, setSelectedUploadName] = useState<string>("");
  const [webhookFile, setWebhookFile] = useState<File | null>(null);
  const [isWebhookSending, setIsWebhookSending] = useState(false);
  const [showN8NProgressModal, setShowN8NProgressModal] = useState(false);
  const [n8nResult, setN8nResult] = useState<{total_linhas_enviadas: number} | null>(null);
  const [n8nError, setN8nError] = useState<boolean>(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [fileLineCount, setFileLineCount] = useState<number>(0);
  const webhookFileInputRef = useRef<HTMLInputElement>(null);

  // Função para contar linhas do arquivo Excel
  const countFileLines = async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Contar linhas não vazias (excluindo cabeçalho)
          const nonEmptyRows = jsonData.filter((row: any) => 
            Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '')
          );
          
          // Subtrair 1 para excluir o cabeçalho
          const dataRows = Math.max(0, nonEmptyRows.length - 1);
          resolve(dataRows);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
      reader.readAsArrayBuffer(file);
    });
  };

  // N8N Webhook handlers
  const handleWebhookFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Verificar se é um arquivo Excel
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        '.xlsx',
        '.xls'
      ];
      
      const isValidType = validTypes.some(type => 
        file.type === type || file.name.toLowerCase().endsWith(type)
      );
      
      if (!isValidType) {
        if (webhookFileInputRef.current) {
          webhookFileInputRef.current.value = '';
        }
        return;
      }
      
      setWebhookFile(file);
      
      // Contar linhas do arquivo
      try {
        const lineCount = await countFileLines(file);
        setFileLineCount(lineCount);
      } catch (error) {
        console.error('Erro ao contar linhas do arquivo:', error);
        setFileLineCount(0);
      }
    }
  };

  // Função para mostrar modal de confirmação
  const showConfirmation = () => {
    if (!webhookFile) {
      return;
    }
    
    if (!selectedUploadName) {
      return;
    }
    
    if (!user?.id) {
      return;
    }

    setShowConfirmationModal(true);
  };

  // Função para confirmar e enviar dados
  const confirmAndSendWebhook = async () => {
    setShowConfirmationModal(false);
    setIsWebhookSending(true);
    setShowN8NProgressModal(true);
    setN8nResult(null);
    setN8nError(false);
    
    // Determinar qual webhook usar baseado na seleção (fora do try-catch)
    let webhookUrl: string = '';
    if (selectedUploadName === 'positivador') {
      webhookUrl = 'https://n8n-n8n.ffder9.easypanel.host/webhook-test/positivador';
    } else if (selectedUploadName === 'dados_captacoes') {
      webhookUrl = 'https://n8n-n8n.ffder9.easypanel.host/webhook/uploads';
    } else if (selectedUploadName === 'cetipados') {
      webhookUrl = 'https://n8n-n8n.ffder9.easypanel.host/webhook-test/cetipados';
    } else {
      // Para outros tipos, usar o webhook padrão
      webhookUrl = 'https://n8n-n8n.ffder9.easypanel.host/webhook/uploads';
    }
    
    try {
      // Verificar se o arquivo ainda é válido
      if (!webhookFile || webhookFile.size === 0) {
        throw new Error('Arquivo inválido ou vazio. Por favor, selecione o arquivo novamente.');
      }
      
      // Criar FormData diretamente com o arquivo original para evitar problemas de leitura
      const formData = new FormData();
      
      // Renomear o arquivo apenas no FormData
      const fileExtension = webhookFile.name.split('.').pop();
      const newFileName = `${selectedUploadName}.${fileExtension}`;
      
      // Usar o arquivo original mas com nome modificado
      formData.append('file', webhookFile, newFileName);
      formData.append('selected_name', selectedUploadName);
      formData.append('user_id', user.id);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const result = await response.json();
      
      console.log('Resposta completa do webhook:', result);
      console.log('Tipo da resposta:', typeof result);
      console.log('Chaves da resposta:', Object.keys(result || {}));
      
      // Verificar se há erro no status
      if (result && result.status === 'erro') {
        setN8nError(true);
        setN8nResult(null);
        return;
      }
      
      // Processar resultado do N8N - verificar diferentes estruturas possíveis
      let totalLinhas = null;
      
      // Verificar se total_linhas_enviadas está diretamente na resposta
      if (result && typeof result.total_linhas_enviadas === 'number') {
        totalLinhas = result.total_linhas_enviadas;
      }
      // Verificar se está em uma propriedade aninhada
      else if (result && result.data && typeof result.data.total_linhas_enviadas === 'number') {
        totalLinhas = result.data.total_linhas_enviadas;
      }
      // Verificar se está em um array de resultados
      else if (result && Array.isArray(result) && result.length > 0 && typeof result[0].total_linhas_enviadas === 'number') {
        totalLinhas = result[0].total_linhas_enviadas;
      }
      // Verificar outras possíveis estruturas
      else if (result && result.output && typeof result.output.total_linhas_enviadas === 'number') {
        totalLinhas = result.output.total_linhas_enviadas;
      }
      
      if (totalLinhas !== null) {
        setN8nResult({ total_linhas_enviadas: totalLinhas });
      } else {
        console.warn('Estrutura de resposta inesperada:', result);
        setN8nResult({ total_linhas_enviadas: 0 });
      }
      
      // Limpar arquivo após envio bem-sucedido
      setWebhookFile(null);
      setSelectedUploadName("");
      if (webhookFileInputRef.current) {
        webhookFileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Erro ao enviar webhook:', error);
      setN8nError(true);
      setN8nResult(null);
    } finally {
      setIsWebhookSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <Send className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Atualização de Dados</h2>
          <p className="text-muted-foreground">
            Envie arquivos Excel para processamento automático
          </p>
        </div>
      </div>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-400" />
            Upload de Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upload-name">Nome do Upload</Label>
              <Select value={selectedUploadName} onValueChange={setSelectedUploadName}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de upload" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dados_captacoes">Dados de Captações</SelectItem>
                  <SelectItem value="positivador">Dados de Positivador</SelectItem>
                  <SelectItem value="cetipados">Dados Cetipados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-file">Arquivo Excel</Label>
              <Input
                id="webhook-file"
                type="file"
                accept=".xlsx,.xls"
                ref={webhookFileInputRef}
                onChange={handleWebhookFileChange}
                className="cursor-pointer"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={showConfirmation}
                disabled={!webhookFile || !selectedUploadName || isWebhookSending}
                className="flex items-center gap-2"
              >
                {isWebhookSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isWebhookSending ? 'Enviando...' : 'Enviar Dados'}
              </Button>
            </div>

            {webhookFile && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-sm text-blue-300">
                  <strong>Arquivo selecionado:</strong> {webhookFile.name}
                </p>
                <p className="text-sm text-blue-300">
                  <strong>Tipo de upload:</strong> {selectedUploadName || 'Não selecionado'}
                </p>
                <p className="text-sm text-blue-300">
                  <strong>Linhas de dados:</strong> {fileLineCount} {fileLineCount === 1 ? 'linha' : 'linhas'}
                </p>
              </div>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Informação:</strong> O arquivo será enviado para processamento automático via N8N. 
                Certifique-se de selecionar o tipo correto de upload antes de enviar.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Modal de progresso */}
      <Dialog open={showN8NProgressModal} onOpenChange={isWebhookSending ? undefined : (open) => {
        if (!open) {
          setShowN8NProgressModal(false);
          setN8nError(false);
          setN8nResult(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isWebhookSending ? (
                "Enviando para o banco de dados"
              ) : n8nError ? (
                "Erro no processamento"
              ) : n8nResult ? (
                "Processamento concluído"
              ) : (
                "Processamento de Dados"
              )}
            </DialogTitle>
            <DialogDescription>
              {isWebhookSending 
                ? "Estamos processando seus dados automaticamente. Por favor, aguarde..."
                : n8nError
                ? "Ocorreu um erro ao enviar os dados para o Supabase. Verifique as informações e tente novamente."
                : n8nResult 
                ? `Dados processados com sucesso! ${n8nResult.total_linhas_enviadas} linhas foram enviadas para o banco de dados.`
                : "Processamento finalizado."
              }
            </DialogDescription>
          </DialogHeader>

          {isWebhookSending && (
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Processando arquivo automaticamente...
              </p>
            </div>
          )}

          {n8nError && (
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-red-600">
                  Erro no processamento
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Verifique se selecionou corretamente o tipo de arquivo no dropdown e se as colunas não foram renomeadas no arquivo original.
                </p>
              </div>
            </div>
          )}

          {n8nResult && !n8nError && (
            <div className="space-y-3">
              <div className="flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-green-600">
                  {n8nResult.total_linhas_enviadas} linhas processadas
                </p>
                <p className="text-sm text-muted-foreground">
                  Os dados foram enviados com sucesso para o banco de dados.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação */}
      <Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Envio de Dados</DialogTitle>
            <DialogDescription>
              Você está prestes a enviar os dados para o banco de dados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Arquivo:</strong> {webhookFile?.name}
                </p>
                <p className="text-sm">
                  <strong>Tabela de destino:</strong> {selectedUploadName}
                </p>
                <p className="text-sm">
                  <strong>Quantidade de linhas:</strong> {fileLineCount} {fileLineCount === 1 ? 'linha' : 'linhas'}
                </p>
              </div>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              Deseja realmente enviar {fileLineCount} {fileLineCount === 1 ? 'linha' : 'linhas'} para a tabela <strong>{selectedUploadName}</strong> no banco de dados?
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmationModal(false)}
                className="w-full py-2.5"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmAndSendWebhook}
                className="w-full py-2.5 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Confirmar Envio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}