import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../integrations/supabase/client";
import { ColumnMappingModal } from "./ColumnMappingModal";
import * as XLSX from 'xlsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Progress } from "./ui/progress";

// Helper: normaliza data do Excel (DD/MM/YYYY ou serial) para YYYY-MM-DD
const normalizeExcelDateToISO = (value: any): string | null => {
  if (value == null) return null;
  // Serial numérico do Excel
  if (typeof value === 'number') {
    const parsed = (XLSX as any).SSF?.parse_date_code?.(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${String(parsed.y).padStart(4, '0')}-${pad(parsed.m)}-${pad(parsed.d)}`;
    }
    // Fallback: conversão por epoch (UTC)
    const epoch = new Date(Math.round((value - 25569) * 86400 * 1000));
    const y = epoch.getUTCFullYear();
    const m = epoch.getUTCMonth() + 1;
    const d = epoch.getUTCDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  // String
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Formato DD/MM/YYYY ou DD-MM-YYYY
    const slash = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (slash) {
      const d = parseInt(slash[1], 10);
      const m = parseInt(slash[2], 10);
      const y = parseInt(slash[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${y}-${pad(m)}-${pad(d)}`;
      }
    }
    // Já em ISO
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const y = parseInt(iso[1], 10);
      const m = parseInt(iso[2], 10);
      const d = parseInt(iso[3], 10);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${y}-${pad(m)}-${pad(d)}`;
    }
    return null;
  }
  // Objeto Date
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  return null;
};

// Helper para construir uma chave única do registro (usada para identificar duplicados)
const buildRecordKey = (r: any) => `${r.data_captacao}|${r.data_atualizacao}|${r.cod_cliente}|${r.tipo_captacao}|${r.cod_assessor}|${r.valor_captacao}`;

interface UploadResult {
  success: boolean;
  message: string;
  insertedCount: number;
  errors?: string[];
  duplicatesIgnoredCount?: number;
  duplicatesSample?: string[];
}

interface ColumnMapping {
  excelColumn: string;
  dbColumn: string | null;
  isRequired: boolean;
  isSelected: boolean;
}

export function DataUploadManagement() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [recentData, setRecentData] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [preparedRecords, setPreparedRecords] = useState<any[]>([]);
  const [prepareErrors, setPrepareErrors] = useState<string[]>([]);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressInsertedCount, setProgressInsertedCount] = useState(0);
  const [existingKeysSet, setExistingKeysSet] = useState<Set<string> | null>(null);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [duplicatesSampleList, setDuplicatesSampleList] = useState<string[]>([]);

  const fetchRecentData = async () => {
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('dados_captacoes')
        .select('id, data_captacao, cod_assessor, cod_cliente, tipo_captacao, valor_captacao, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentData(data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error("Erro ao carregar dados recentes");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Busca registros existentes no banco que intersectam com os valores dos registros preparados
  const findExistingDuplicates = async (records: any[]) => {
    if (!records || records.length === 0) {
      return { existingKeys: new Set<string>(), duplicates: [] as any[] };
    }

    const unique = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)));

    const clientes = unique(records.map((r) => r.cod_cliente));
    const datas = unique(records.map((r) => r.data_captacao));
    const datasAtualizacao = unique(records.map((r) => r.data_atualizacao));
    const tipos = unique(records.map((r) => r.tipo_captacao));
    const assessores = unique(records.map((r) => r.cod_assessor));

    // Monta a query aplicando filtros "in" apenas quando houver valores
    let query = supabase
      .from('dados_captacoes')
      .select('data_captacao, data_atualizacao, cod_cliente, tipo_captacao, valor_captacao, cod_assessor');

    if (clientes.length > 0) query = query.in('cod_cliente', clientes);
    if (datas.length > 0) query = query.in('data_captacao', datas);
    if (datasAtualizacao.length > 0) query = query.in('data_atualizacao', datasAtualizacao);
    if (tipos.length > 0) query = query.in('tipo_captacao', tipos);
    if (assessores.length > 0) query = query.in('cod_assessor', assessores);

    const { data, error } = await query;
    if (error) throw error;

    const existingKeys = new Set<string>((data || []).map((d: any) => buildRecordKey(d)));
    const duplicates = records.filter((r) => existingKeys.has(buildRecordKey(r)));
    return { existingKeys, duplicates };
  };

  const handleMappingConfirm = async (mappings: ColumnMapping[]) => {
    setShowMappingModal(false);
    setIsUploading(true);
    setColumnMappings(mappings);

    try {
      const validRecords: any[] = [];
      const errors: string[] = [];

      excelData.forEach((row: any, index: number) => {
        try {
          const record: any = {};
          
          // Aplicar mapeamento de colunas
          mappings.forEach(mapping => {
            if (mapping.dbColumn && row[mapping.excelColumn] !== undefined) {
              let value = row[mapping.excelColumn];
              
              // Conversões específicas por tipo de coluna
              if (mapping.dbColumn === 'data_captacao' || mapping.dbColumn === 'data_atualizacao') {
                const iso = normalizeExcelDateToISO(value);
                if (!iso) {
                  errors.push(`Linha ${index + 2}: Data inválida na coluna ${mapping.excelColumn}`);
                  return;
                }
                record[mapping.dbColumn] = iso;
              } else if (mapping.dbColumn === 'valor_captacao') {
                // Converter para número
                const numValue = parseFloat(value);
                if (isNaN(numValue)) {
                  errors.push(`Linha ${index + 2}: Valor numérico inválido na coluna ${mapping.excelColumn}`);
                  return;
                }
                record[mapping.dbColumn] = numValue;
              } else {
                // Converter para string
                record[mapping.dbColumn] = String(value).trim();
              }
            }
          });

          // Validar campos obrigatórios
          const requiredFields = ['data_captacao', 'cod_assessor', 'cod_cliente', 'tipo_captacao', 'aux', 'valor_captacao', 'data_atualizacao', 'tipo_pessoa'];
          const missingFields = requiredFields.filter(field => !record[field]);
          
          if (missingFields.length > 0) {
            errors.push(`Linha ${index + 2}: Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
            return;
          }

          validRecords.push(record);
        } catch (err: any) {
          errors.push(`Linha ${index + 2}: Erro ao processar registro - ${err?.message || err}`);
        }
      });

      if (validRecords.length === 0) {
        setUploadResult({
          success: false,
          message: 'Nenhum registro válido encontrado',
          insertedCount: 0,
          errors: errors.length > 0 ? errors : ['Nenhum registro válido encontrado']
        });
        setIsUploading(false);
        return;
      }

      // Identificar duplicados existentes no banco
      const { existingKeys, duplicates } = await findExistingDuplicates(validRecords);
      setExistingKeysSet(existingKeys);
      setDuplicateCount(duplicates.length);
      setDuplicatesSampleList(duplicates.map(formatDuplicateSummary));

      // Preparar confirmação antes de enviar
      setPreparedRecords(validRecords);
      setPrepareErrors(errors);
      setShowConfirmDialog(true);
      setIsUploading(false);
      return;

    } catch (error) {
      console.error('Erro no upload:', error);
      setUploadResult({
        success: false,
        message: `Erro ao processar dados: ${error}`,
        insertedCount: 0,
        errors: [`Erro: ${error}`]
      });
      toast.error("Erro ao processar os dados");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error("Por favor, selecione um arquivo Excel (.xlsx ou .xls)");
      // Limpar o input ao selecionar arquivo inválido
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error("O arquivo Excel está vazio");
        return;
      }

      // Extrair colunas do Excel
      const firstRow = jsonData[0] as any;
      const columns = Object.keys(firstRow);

      // Armazenar dados do Excel
      setExcelData(jsonData);
      setExcelColumns(columns);

      // Auto-mapeamento de colunas do Excel para colunas do banco
      const requiredDbFields = ['data_captacao', 'cod_assessor', 'cod_cliente', 'tipo_captacao', 'aux', 'valor_captacao', 'data_atualizacao', 'tipo_pessoa'];
      const normalize = (s: string) => s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase();

      const candidates: Record<string, string[]> = {
        data_captacao: ['datacaptacao', 'datacaptaçao', 'datacaptação', 'datacap', 'dtcaptacao', 'dtcap'],
        data_atualizacao: ['dataatualizacao', 'dataatualização', 'dtatualizacao', 'atualizacao', 'dtatu'],
        cod_assessor: ['codassessor', 'assessor', 'idassessor', 'codigoassessor'],
        cod_cliente: ['codcliente', 'cliente', 'idcliente', 'codigocliente'],
        tipo_captacao: ['tipocaptacao', 'tipo', 'captacao', 'captacao_tipo'],
        aux: ['aux', 'auxiliar'],
        valor_captacao: ['valorcaptacao', 'valor', 'valorcapt', 'vlrcaptacao', 'vldacaptacao', 'vlrcapt'],
        tipo_pessoa: ['tipopessoa', 'fisicajuridica', 'pfpj', 'tipocliente', 'tpessoa']
      };

      const autoMappings: ColumnMapping[] = columns.map((excelCol) => {
        const n = normalize(excelCol);
        let dbColumn: string | null = null;
        let isRequired = false;
        let isSelected = false;

        // Tentativa de match direto com campos obrigatórios
        for (const dbField of requiredDbFields) {
          const dbNorm = normalize(dbField);
          const candList = candidates[dbField] || [];
          if (n === dbNorm || candList.includes(n)) {
            dbColumn = dbField;
            isRequired = true;
            isSelected = true;
            break;
          }
        }

        return {
          excelColumn: excelCol,
          dbColumn,
          isRequired,
          isSelected
        };
      });

      // Definir mapeamentos iniciais
      setColumnMappings(autoMappings);

      // Abrir modal de mapeamento
      setShowMappingModal(true);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error("Erro ao processar o arquivo Excel");
    } finally {
      setIsUploading(false);
      // Limpar o input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const startUpload = async () => {
    try {
      setShowConfirmDialog(false);
      setShowProgressModal(true);
      setIsUploading(true);
      setProgressPercent(0);
      setProgressInsertedCount(0);

      // Ignorar duplicados já existentes no banco
      const toInsert = preparedRecords.filter((r) => !existingKeysSet?.has(buildRecordKey(r)));
      const total = toInsert.length;
      const chunkSize = 500; // envio em lotes para evitar travamentos
      const totalChunks = total > 0 ? Math.ceil(total / chunkSize) : 0;
      const allErrors: string[] = [...prepareErrors];
      let insertedCountLocal = 0; // usar variável local para contagem correta

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, total);
        const chunk = toInsert.slice(start, end);

        const { error: insertError } = await supabase
          .from('dados_captacoes')
          .insert(chunk);

        if (insertError) {
          console.error('Erro ao inserir dados:', insertError);
          allErrors.push(`Erro do banco ao inserir bloco ${i + 1}/${totalChunks}: ${insertError.message}`);
        } else {
          insertedCountLocal += chunk.length;
          setProgressInsertedCount(insertedCountLocal); // atualizar progresso visual
        }

        setProgressPercent(totalChunks > 0 ? Math.round(((i + 1) / totalChunks) * 100) : 100);
        // pequena pausa para permitir re-render
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      setShowProgressModal(false);

      const chunkErrorsAdded = allErrors.length > prepareErrors.length;
      const success = !chunkErrorsAdded;

      setUploadResult({
        success,
        message: success
          ? `Upload realizado com sucesso! ${insertedCountLocal} registros inseridos. ${duplicateCount} registro(s) duplicado(s) foram ignorados.`
          : `Upload concluído com erros. Consulte a lista de erros abaixo.`,
        insertedCount: insertedCountLocal,
        errors: allErrors.length > 0 ? allErrors : undefined,
        duplicatesIgnoredCount: duplicateCount,
        duplicatesSample: duplicatesSampleList,
      });

      fetchRecentData();

      if (success) {
        toast.success(`${insertedCountLocal} registros importados com sucesso! ${duplicateCount} duplicado(s) ignorado(s).`);
      } else {
        toast.error(`Upload concluído com ${allErrors.length - prepareErrors.length} erro(s) de inserção.`);
      }
    } catch (error) {
      console.error('Erro no envio:', error);
      toast.error('Erro inesperado durante o envio.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDateDisplay = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDuplicateSummary = (r: any) => `Data: ${r.data_captacao} | Atualização: ${r.data_atualizacao} | Cliente: ${r.cod_cliente} | Tipo: ${r.tipo_captacao} | Assessor: ${r.cod_assessor} | Valor: ${typeof r.valor_captacao === 'number' ? formatCurrency(r.valor_captacao) : r.valor_captacao}`;

  useEffect(() => {
    fetchRecentData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload de Captações */}
        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Dados de Captações</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Importe planilha Excel com dados de captações
                </p>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0 space-y-4">
            <div className="space-y-3">
              <Label htmlFor="captacoes-file">Selecionar arquivo Excel</Label>
              <Input
                id="captacoes-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Selecionar Arquivo
                  </>
                )}
              </Button>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Colunas obrigatórias:</strong> data_captacao, cod_assessor, cod_cliente, 
                tipo_captacao, aux, valor_captacao, data_atualizacao, tipo_pessoa
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Upload de Positivador */}
        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                <FileSpreadsheet className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Dados de Positivador</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Importe planilha Excel com dados de positivador
                </p>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0 space-y-4">
            <div className="space-y-3">
              <Label htmlFor="positivador-file">Selecionar arquivo Excel</Label>
              <Input
                id="positivador-file"
                type="file"
                accept=".xlsx,.xls"
                disabled={true}
              />
              <Button
                disabled={true}
                className="w-full"
                variant="outline"
              >
                <Upload className="w-4 h-4 mr-2" />
                Em Desenvolvimento
              </Button>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Esta funcionalidade será implementada após você fornecer a estrutura da tabela de positivador.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Resultado do Upload */}
      {uploadResult && (
        <Card className="p-6">
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center gap-2">
              {uploadResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <h3 className="font-semibold">Resultado do Upload</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <p className="text-sm text-muted-foreground">Registros Importados</p>
                <p className="text-2xl font-bold text-green-400">{uploadResult.insertedCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-muted-foreground">Erros Encontrados</p>
                <p className="text-2xl font-bold text-red-400">{uploadResult.errors?.length || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm text-muted-foreground">Duplicados Ignorados</p>
                <p className="text-2xl font-bold text-amber-400">{uploadResult.duplicatesIgnoredCount || 0}</p>
              </div>
            </div>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-400">Erros encontrados:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {uploadResult.errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-300 bg-red-500/10 p-2 rounded">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {uploadResult.duplicatesIgnoredCount && uploadResult.duplicatesIgnoredCount > 0 && uploadResult.duplicatesSample && uploadResult.duplicatesSample.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-amber-400">Registros duplicados (não enviados):</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {uploadResult.duplicatesSample.slice(0, 30).map((dup, index) => (
                    <p key={index} className="text-sm text-amber-300 bg-amber-500/10 p-2 rounded">
                      {dup}
                    </p>
                  ))}
                  {uploadResult.duplicatesSample.length > 30 && (
                    <p className="text-xs">... e mais {uploadResult.duplicatesSample.length - 30}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Últimos Registros Adicionados */}
      <Card className="p-6">
        <CardContent className="p-0 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Últimas 10 Captações Adicionadas</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRecentData}
              disabled={isLoadingData}
            >
              {isLoadingData ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Atualizar'
              )}
            </Button>
          </div>

          {isLoadingData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : recentData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Captação</TableHead>
                    <TableHead>Assessor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Adicionado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentData.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDateDisplay(record.data_captacao)}</TableCell>
                      <TableCell>{record.cod_assessor}</TableCell>
                      <TableCell>{record.cod_cliente}</TableCell>
                      <TableCell>{record.tipo_captacao}</TableCell>
                      <TableCell>{formatCurrency(record.valor_captacao)}</TableCell>
                      <TableCell>{formatDateDisplay(record.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Popup de confirmação antes de enviar */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateCount > 0 ? (
                <>
                  Você está prestes a enviar {Math.max(0, preparedRecords.length - duplicateCount)} linha(s) para o banco de dados.
                  Encontramos {duplicateCount} registro(s) que já existem e serão ignorados no envio.
                </>
              ) : (
                <>Você está prestes a enviar {preparedRecords.length} linha(s) para o banco de dados. Deseja continuar?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {prepareErrors.length > 0 && (
            <div className="mt-2 text-sm">
              <p className="text-red-600 font-medium">Linhas inválidas ou com erro: {prepareErrors.length}</p>
              <div className="max-h-24 overflow-y-auto mt-2 bg-red-50 border border-red-200 rounded p-2 text-red-700">
                {prepareErrors.slice(0, 5).map((err, idx) => (
                  <p key={idx}>{err}</p>
                ))}
                {prepareErrors.length > 5 && (
                  <p className="text-xs mt-1">... e mais {prepareErrors.length - 5}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={startUpload} disabled={preparedRecords.length === 0}>
              Confirmar e enviar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de progresso durante envio */}
      <Dialog open={showProgressModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviando dados</DialogTitle>
            <DialogDescription>
              Estamos enviando os registros ao servidor. Por favor, aguarde.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Progresso</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} />
            <p className="text-sm text-muted-foreground">
              Inseridos: {progressInsertedCount} de {Math.max(0, preparedRecords.length - duplicateCount)}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Mapeamento de Colunas */}
      <ColumnMappingModal
        isOpen={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        onConfirm={handleMappingConfirm}
        excelColumns={excelColumns}
      />
    </div>
  );
}