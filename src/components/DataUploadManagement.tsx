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
  if (value == null || value === '') return null;
  
  console.log('normalizeExcelDateToISO - valor recebido:', value, 'tipo:', typeof value);
  
  // Serial numérico do Excel
  if (typeof value === 'number') {
    console.log('É um número (data serial):', value);
    try {
      const parsed = (XLSX as any).SSF?.parse_date_code?.(value);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const isoDate = `${String(parsed.y).padStart(4, '0')}-${pad(parsed.m)}-${pad(parsed.d)}`;
        console.log('Data convertida via SSF para ISO:', isoDate);
        return isoDate;
      }
      // Fallback: conversão por epoch (UTC)
      const epoch = new Date(Math.round((value - 25569) * 86400 * 1000));
      const y = epoch.getUTCFullYear();
      const m = epoch.getUTCMonth() + 1;
      const d = epoch.getUTCDate();
      const pad = (n: number) => String(n).padStart(2, '0');
      const isoDate = `${y}-${pad(m)}-${pad(d)}`;
      console.log('Data convertida via epoch para ISO:', isoDate);
      return isoDate;
    } catch (error) {
      console.error('Erro ao converter data numérica:', value, error);
      return null;
    }
  }
  
  // String
  if (typeof value === 'string') {
    const trimmed = value.trim();
    console.log('É uma string:', trimmed);
    if (!trimmed) return null;
    
    // Formato DD/MM/YYYY ou DD-MM-YYYY (mais comum no Brasil)
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (ddmmyyyy) {
      const d = parseInt(ddmmyyyy[1], 10);
      const m = parseInt(ddmmyyyy[2], 10);
      const y = parseInt(ddmmyyyy[3], 10);
      console.log('Formato dd/mm/yyyy detectado:', { day: d, month: m, year: y });
      
      // Validação básica de data
      if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        // Validação mais específica por mês
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const isLeapYear = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
        const maxDays = m === 2 && isLeapYear ? 29 : daysInMonth[m - 1];
        
        if (d <= maxDays) {
          const pad = (n: number) => String(n).padStart(2, '0');
          const isoDate = `${y}-${pad(m)}-${pad(d)}`;
          console.log('Data convertida para ISO:', isoDate);
          return isoDate;
        }
      }
    }
    
    // Formato YYYY-MM-DD (já em ISO)
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const y = parseInt(iso[1], 10);
      const m = parseInt(iso[2], 10);
      const d = parseInt(iso[3], 10);
      if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const isoDate = `${y}-${pad(m)}-${pad(d)}`;
        console.log('Data já em formato ISO:', isoDate);
        return isoDate;
      }
    }
    
    // Tentar usar Date.parse como último recurso
    console.log('Tentando outros formatos de data');
    try {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        if (y >= 1900 && y <= 2100) {
          const pad = (n: number) => String(n).padStart(2, '0');
          const isoDate = `${y}-${pad(m)}-${pad(d)}`;
          console.log('Data convertida via Date.parse para ISO:', isoDate);
          return isoDate;
        }
      }
    } catch (error) {
      console.error('Erro ao converter data string:', value, error);
    }
  }
  
  // Objeto Date
  if (value instanceof Date) {
    console.log('É um objeto Date:', value);
    if (!isNaN(value.getTime())) {
      const y = value.getFullYear();
      const m = value.getMonth() + 1;
      const d = value.getDate();
      const pad = (n: number) => String(n).padStart(2, '0');
      const isoDate = `${y}-${pad(m)}-${pad(d)}`;
      console.log('Data convertida de objeto Date para ISO:', isoDate);
      return isoDate;
    } else {
      console.error('Objeto Date inválido:', value);
      return null;
    }
  }
  
  console.warn('Formato de data não reconhecido:', value, typeof value);
  return null;
};

// Helper para sanitizar valores antes de processar
const sanitizeValue = (value: any): any => {
  if (value === null || value === undefined) return null;
  
  // Se for um objeto Date, manter como está para processamento posterior
  if (value instanceof Date) {
    return value;
  }
  
  // Se for um objeto complexo, tentar extrair valor primitivo
  if (typeof value === 'object' && value !== null) {
    // Se tem propriedade valueOf, usar ela
    if (typeof value.valueOf === 'function') {
      const primitiveValue = value.valueOf();
      if (typeof primitiveValue !== 'object') {
        return primitiveValue;
      }
    }
    
    // Se tem propriedade toString, usar ela
    if (typeof value.toString === 'function') {
      const stringValue = value.toString();
      if (stringValue !== '[object Object]') {
        return stringValue;
      }
    }
    
    // Se for um array, pegar o primeiro elemento
    if (Array.isArray(value) && value.length > 0) {
      return sanitizeValue(value[0]);
    }
    
    // Como último recurso, retornar null
    return null;
  }
  
  return value;
};

// Helper para construir uma chave única do registro (usada para identificar duplicados)
const buildRecordKey = (r: any) => `${r.data_captacao}|${r.cod_cliente}|${r.tipo_captacao}|${r.cod_assessor}|${r.valor_captacao}`;

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

// Database columns for positivador
const POSITIVADOR_DATABASE_COLUMNS = [
  { key: 'assessor', label: 'Assessor', required: true },
  { key: 'cliente', label: 'Cliente', required: true },
  { key: 'profissao', label: 'Profissão', required: false },
  { key: 'sexo', label: 'Sexo', required: false },
  { key: 'segmento', label: 'Segmento', required: false },
  { key: 'data_cadastro', label: 'Data Cadastro', required: false },
  { key: 'fez_segundo_aporte', label: 'Fez Segundo Aporte', required: false },
  { key: 'data_nascimento', label: 'Data Nascimento', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'ativou_em_m', label: 'Ativou em M', required: false },
  { key: 'evadiu_em_m', label: 'Evadiu em M', required: false },
  { key: 'operou_bolsa', label: 'Operou Bolsa', required: false },
  { key: 'operou_fundo', label: 'Operou Fundo', required: false },
  { key: 'operou_renda_fixa', label: 'Operou Renda Fixa', required: false },
  { key: 'aplicacao_financeira_declarada_ajustada', label: 'Aplicação Financeira Declarada Ajustada', required: false },
  { key: 'receita_no_mes', label: 'Receita no Mês', required: false },
  { key: 'receita_bovespa', label: 'Receita Bovespa', required: false },
  { key: 'receita_futuros', label: 'Receita Futuros', required: false },
  { key: 'receita_rf_bancarios', label: 'Receita RF Bancários', required: false },
  { key: 'receita_rf_privados', label: 'Receita RF Privados', required: false },
  { key: 'receita_rf_publicos', label: 'Receita RF Públicos', required: false },
  { key: 'captacao_bruta_em_m', label: 'Captação Bruta em M', required: false },
  { key: 'resgate_em_m', label: 'Resgate em M', required: false },
  { key: 'captacao_liquida_em_m', label: 'Captação Líquida em M', required: false },
  { key: 'captacao_ted', label: 'Captação TED', required: false },
  { key: 'captacao_st', label: 'Captação ST', required: false },
  { key: 'captacao_ota', label: 'Captação OTA', required: false },
  { key: 'captacao_rf', label: 'Captação RF', required: false },
  { key: 'captacao_td', label: 'Captação TD', required: false },
  { key: 'captacao_prev', label: 'Captação Prev', required: false },
  { key: 'net_em_m_1', label: 'Net em M-1', required: false },
  { key: 'net_em_m', label: 'Net em M', required: false },
  { key: 'net_renda_fixa', label: 'Net Renda Fixa', required: false },
  { key: 'net_fundos_imobiliarios', label: 'Net Fundos Imobiliários', required: false },
  { key: 'net_renda_variavel', label: 'Net Renda Variável', required: false },
  { key: 'net_fundos', label: 'Net Fundos', required: false },
  { key: 'net_financeiro', label: 'Net Financeiro', required: false },
  { key: 'net_previdencia', label: 'Net Previdência', required: false },
  { key: 'net_outros', label: 'Net Outros', required: false },
  { key: 'receita_aluguel', label: 'Receita Aluguel', required: false },
  { key: 'receita_complemento_pacote_corretagem', label: 'Receita Complemento Pacote Corretagem', required: false },
  { key: 'tipo_pessoa', label: 'Tipo Pessoa', required: false },
  { key: 'data_posicao', label: 'Data Posição', required: true },
  { key: 'data_atualizacao', label: 'Data Atualização', required: true },
];

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

  // Positivador states
  const [isUploadingPositivador, setIsUploadingPositivador] = useState(false);
  const [uploadResultPositivador, setUploadResultPositivador] = useState<UploadResult | null>(null);
  const [recentDataPositivador, setRecentDataPositivador] = useState<any[]>([]);
  const [isLoadingDataPositivador, setIsLoadingDataPositivador] = useState(false);
  const [showMappingModalPositivador, setShowMappingModalPositivador] = useState(false);
  const [excelDataPositivador, setExcelDataPositivador] = useState<any[]>([]);
  const [excelColumnsPositivador, setExcelColumnsPositivador] = useState<string[]>([]);
  const [columnMappingsPositivador, setColumnMappingsPositivador] = useState<ColumnMapping[]>([]);
  const fileInputRefPositivador = useRef<HTMLInputElement>(null);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [preparedRecords, setPreparedRecords] = useState<any[]>([]);
  const [prepareErrors, setPrepareErrors] = useState<string[]>([]);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressInsertedCount, setProgressInsertedCount] = useState(0);
  const [existingKeysSet, setExistingKeysSet] = useState<Set<string> | null>(null);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [duplicatesSampleList, setDuplicatesSampleList] = useState<string[]>([]);

  // Positivador specific states
  const [showConfirmDialogPositivador, setShowConfirmDialogPositivador] = useState(false);
  const [preparedRecordsPositivador, setPreparedRecordsPositivador] = useState<any[]>([]);
  const [prepareErrorsPositivador, setPrepareErrorsPositivador] = useState<string[]>([]);
  const [showProgressModalPositivador, setShowProgressModalPositivador] = useState(false);
  const [progressPercentPositivador, setProgressPercentPositivador] = useState(0);
  const [progressInsertedCountPositivador, setProgressInsertedCountPositivador] = useState(0);
  const [existingKeysSetPositivador, setExistingKeysSetPositivador] = useState<Set<string> | null>(null);
  const [duplicateCountPositivador, setDuplicateCountPositivador] = useState<number>(0);
  const [duplicatesSampleListPositivador, setDuplicatesSampleListPositivador] = useState<string[]>([]);

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

    // Fetch all records with pagination to avoid Supabase's 1000 row limit
    const fetched: any[] = [];
    let start = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      // Monta a query aplicando filtros "in" apenas quando houver valores
      let query = supabase
        .from('dados_captacoes')
        .select('data_captacao, data_atualizacao, cod_cliente, tipo_captacao, valor_captacao, cod_assessor')
        .range(start, start + pageSize - 1);

      if (clientes.length > 0) query = query.in('cod_cliente', clientes);
      if (datas.length > 0) query = query.in('data_captacao', datas);
      if (datasAtualizacao.length > 0) query = query.in('data_atualizacao', datasAtualizacao);
      if (tipos.length > 0) query = query.in('tipo_captacao', tipos);
      if (assessores.length > 0) query = query.in('cod_assessor', assessores);

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        fetched.push(...data);
        hasMore = data.length === pageSize;
        start += pageSize;
      } else {
        hasMore = false;
      }
    }

    const existingKeys = new Set<string>(fetched.map((d: any) => buildRecordKey(d)));
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
      const processedKeys = new Set<string>();

      excelData.forEach((row: any, index: number) => {
        try {
          const record: any = {};
          
          // Aplicar mapeamento de colunas
          mappings.forEach(mapping => {
            if (mapping.dbColumn && row[mapping.excelColumn] !== undefined) {
              let value = sanitizeValue(row[mapping.excelColumn]);
              
              // Se após sanitização o valor for null/undefined, pular
              if (value === null || value === undefined) {
                return;
              }
              
              // Conversões específicas por tipo de coluna
              if (mapping.dbColumn === 'data_captacao' || mapping.dbColumn === 'data_atualizacao') {
                console.log(`Processando data na linha ${index + 2}, coluna ${mapping.excelColumn}:`, value, typeof value);
                const iso = normalizeExcelDateToISO(value);
                if (!iso) {
                  console.error(`Erro ao converter data na linha ${index + 2}:`, value, typeof value);
                  errors.push(`Linha ${index + 2}: Data inválida na coluna ${mapping.excelColumn} (valor: ${value}, tipo: ${typeof value})`);
                  return;
                }
                console.log(`Data convertida para ISO:`, iso);
                record[mapping.dbColumn] = iso;
              } else if (mapping.dbColumn === 'valor_captacao') {
                // Converter para número
                const numValue = parseFloat(String(value).replace(/[^\d.,\-]/g, '').replace(',', '.'));
                if (isNaN(numValue)) {
                  errors.push(`Linha ${index + 2}: Valor numérico inválido na coluna ${mapping.excelColumn} (valor: ${value})`);
                  return;
                }
                record[mapping.dbColumn] = numValue;
              } else {
                // Converter para string e limpar
                const stringValue = String(value).trim();
                if (stringValue === '' || stringValue === 'null' || stringValue === 'undefined') {
                  return; // Pular valores vazios
                }
                record[mapping.dbColumn] = stringValue;
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

          // Construir chave única para verificar duplicados
          const recordKey = buildRecordKey(record);
          console.log(`Linha ${index + 2} - Chave construída:`, recordKey, 'Record:', record);
          if (processedKeys.has(recordKey)) {
            console.warn(`Linha ${index + 2}: Registro duplicado encontrado com chave:`, recordKey);
            errors.push(`Linha ${index + 2}: Registro duplicado encontrado`);
            return;
          }
          processedKeys.add(recordKey);
          
          validRecords.push(record);
        } catch (err: any) {
          console.error(`Erro ao processar linha ${index + 2}:`, err, 'Dados da linha:', row);
          errors.push(`Linha ${index + 2}: Erro ao processar registro - ${err?.message || String(err)}`);
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
      
      // Usar opções específicas para evitar objetos complexos
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: true, // Manter valores originais para melhor processamento de datas
        dateNF: 'dd/mm/yyyy', // Formato de data padrão
        defval: '', // Valor padrão para células vazias
        cellDates: true, // Converter datas do Excel para objetos Date
        cellNF: false // Não aplicar formatação de número
      });

      if (jsonData.length === 0) {
        toast.error("O arquivo Excel está vazio");
        return;
      }

      // Sanitizar todos os dados do Excel
      const sanitizedData = jsonData.map((row: any) => {
        const sanitizedRow: any = {};
        Object.keys(row).forEach(key => {
          sanitizedRow[key] = sanitizeValue(row[key]);
        });
        return sanitizedRow;
      });

      // Extrair colunas do Excel
      const firstRow = sanitizedData[0] as any;
      const columns = Object.keys(firstRow);

      // Armazenar dados do Excel sanitizados
      setExcelData(sanitizedData);
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

  // POSITIVADOR FUNCTIONS
  const buildRecordKeyPositivador = (r: any) => `${r.assessor}|${r.cliente}|${r.data_posicao}`;

  const formatDuplicateSummaryPositivador = (r: any) => `Assessor: ${r.assessor} | Cliente: ${r.cliente} | Data Posição: ${r.data_posicao} | Data Atualização: ${r.data_atualizacao}`;

  const fetchRecentDataPositivador = async () => {
    setIsLoadingDataPositivador(true);
    try {
      const { data, error } = await supabase
        .from('dados_positivador')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentDataPositivador(data || []);
    } catch (error) {
      console.error('Erro ao buscar dados do positivador:', error);
      toast.error('Erro ao carregar dados recentes do positivador');
    } finally {
      setIsLoadingDataPositivador(false);
    }
  };

  const findExistingDuplicatesPositivador = async (records: any[]) => {
    if (!records || records.length === 0) {
      return { existingKeys: new Set<string>(), duplicates: [] as any[] };
    }

    const unique = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)));

    const datasPositivador = Array.from(new Set(records.map((r) => r.data_posicao))).filter(Boolean);
    const chunkSize = 100;
    const fetched: any[] = [];

    for (let i = 0; i < datasPositivador.length; i += chunkSize) {
      const chunk = datasPositivador.slice(i, i + chunkSize);
      
      // Fetch all records with pagination to avoid Supabase's 1000 row limit
      let start = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('dados_positivador')
          .select('assessor, cliente, data_posicao')
          .in('data_posicao', chunk)
          .range(start, start + pageSize - 1);
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          fetched.push(...data);
          hasMore = data.length === pageSize;
          start += pageSize;
        } else {
          hasMore = false;
        }
      }
    }

    const existingKeys = new Set<string>(fetched.map((d: any) => buildRecordKeyPositivador(d)));
    const duplicates = records.filter((r) => existingKeys.has(buildRecordKeyPositivador(r)));
    return { existingKeys, duplicates };
  };

  const handleMappingConfirmPositivador = async (mappings: ColumnMapping[]) => {
    setShowMappingModalPositivador(false);
    setIsUploadingPositivador(true);
    setColumnMappingsPositivador(mappings);

    try {
      const validRecords: any[] = [];
      const errors: string[] = [];
      const processedKeys = new Set<string>();

      excelDataPositivador.forEach((row: any, index: number) => {
        try {
          const record: any = {};
          
          // Aplicar mapeamento de colunas
          mappings.forEach(mapping => {
            if (mapping.dbColumn && row[mapping.excelColumn] !== undefined) {
              let value = sanitizeValue(row[mapping.excelColumn]);
              
              // Conversões específicas por tipo de coluna
              if (mapping.dbColumn === 'data_posicao' || mapping.dbColumn === 'data_atualizacao' || 
                  mapping.dbColumn === 'data_cadastro' || mapping.dbColumn === 'data_nascimento') {
                if (value === null || value === undefined) {
                  return;
                }
                const iso = normalizeExcelDateToISO(value);
                if (!iso) {
                  errors.push(`Linha ${index + 2}: Data inválida na coluna ${mapping.excelColumn} (valor: ${value})`);
                  return;
                }
                record[mapping.dbColumn] = iso;
              } else if (mapping.dbColumn.includes('receita_') || mapping.dbColumn.includes('captacao_') || 
                        mapping.dbColumn.includes('net_') || mapping.dbColumn === 'aplicacao_financeira_declarada_ajustada') {
                // Campos que eram numéricos, agora tratados como texto
                if (value === null || value === undefined) {
                  return;
                }
                record[mapping.dbColumn] = String(value).trim();
              } else {
                // Campos de texto
                if (value === null || value === undefined) {
                  return;
                }
                record[mapping.dbColumn] = String(value).trim();
              }
            }
          });

          // Validar campos obrigatórios
          const requiredFields = ['assessor', 'cliente', 'data_posicao', 'data_atualizacao'];
          const missingFields = requiredFields.filter(field => !record[field]);
          
          if (missingFields.length > 0) {
            errors.push(`Linha ${index + 2}: Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
            return;
          }

          // Verificar duplicatas dentro do próprio arquivo
          const recordKey = buildRecordKeyPositivador(record);
          if (processedKeys.has(recordKey)) {
            errors.push(`Linha ${index + 2}: Registro duplicado no arquivo (Assessor: ${record.assessor}, Cliente: ${record.cliente}, Data Posição: ${record.data_posicao})`);
            return;
          }
          processedKeys.add(recordKey);

          validRecords.push(record);
        } catch (error) {
          errors.push(`Linha ${index + 2}: Erro ao processar dados - ${error}`);
        }
      });

      if (validRecords.length === 0) {
        setUploadResultPositivador({
          success: false,
          message: 'Nenhum registro válido encontrado',
          insertedCount: 0,
          errors
        });
        toast.error("Nenhum registro válido encontrado");
        return;
      }

      // Verificar duplicatas no banco
      const { existingKeys, duplicates } = await findExistingDuplicatesPositivador(validRecords);
      setExistingKeysSetPositivador(existingKeys);
      setDuplicateCountPositivador(duplicates.length);
      setDuplicatesSampleListPositivador(duplicates.slice(0, 50).map(formatDuplicateSummaryPositivador));

      // Preparar confirmação antes de enviar
      setPreparedRecordsPositivador(validRecords);
      setPrepareErrorsPositivador(errors);
      setShowConfirmDialogPositivador(true);
      setIsUploadingPositivador(false);
      return;

    } catch (error) {
      console.error('Erro no upload do positivador:', error);
      setUploadResultPositivador({
        success: false,
        message: `Erro ao processar dados: ${error}`,
        insertedCount: 0,
        errors: [`Erro: ${error}`]
      });
      toast.error("Erro ao processar os dados do positivador");
    } finally {
      setIsUploadingPositivador(false);
    }
  };

  const handleFileUploadPositivador = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error("Por favor, selecione um arquivo Excel (.xlsx ou .xls)");
      if (fileInputRefPositivador.current) {
        fileInputRefPositivador.current.value = '';
      }
      return;
    }

    setIsUploadingPositivador(true);
    setUploadResultPositivador(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: true,
        dateNF: 'dd/mm/yyyy',
        defval: '',
        cellDates: true,
        cellNF: false
      });

      if (jsonData.length === 0) {
        toast.error("O arquivo Excel está vazio");
        return;
      }

      const sanitizedData = jsonData.map((row: any) => {
        const sanitizedRow: any = {};
        Object.keys(row).forEach(key => {
          sanitizedRow[key] = sanitizeValue(row[key]);
        });
        return sanitizedRow;
      });

      const firstRow = sanitizedData[0] as any;
      const columns = Object.keys(firstRow);

      setExcelDataPositivador(sanitizedData);
      setExcelColumnsPositivador(columns);

      // Auto-mapeamento de colunas do Excel para colunas do banco (heurística genérica)
      const normalize = (s: string) => s
        .normalize('NFD')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .toLowerCase();

      const tokenize = (s: string) => s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

      const dbMeta = POSITIVADOR_DATABASE_COLUMNS.map(db => ({
        key: db.key,
        label: db.label,
        required: db.required,
        keyNorm: normalize(db.key),
        labelNorm: normalize(db.label),
        tokens: Array.from(new Set([
          ...tokenize(db.label),
          ...db.key.split('_').map(tokenize).flat()
        ]))
      }));

      const usedDbKeys = new Set<string>();

      const autoMappings: ColumnMapping[] = columns.map((excelCol) => {
         const n = normalize(excelCol);
         const excelTokens = tokenize(excelCol);
         let best: { key: string; required: boolean; score: number } | null = null;
 
         for (const db of dbMeta) {
           if (usedDbKeys.has(db.key)) continue;
 
           let score = 0;
           if (n === db.keyNorm) score = 1.0;
           else if (n === db.labelNorm) score = 0.98;
           else if (n.includes(db.keyNorm) || db.keyNorm.includes(n) || n.includes(db.labelNorm) || db.labelNorm.includes(n)) score = 0.9;
           else {
             const setExcel = new Set(excelTokens);
             let overlap = 0;
             for (const tk of db.tokens) {
               if (setExcel.has(tk)) overlap++;
             }
             const denom = Math.max(1, Math.max(excelTokens.length, db.tokens.length));
             const jacc = overlap / denom;
             if (jacc >= 0.6) score = 0.85;
             else if (overlap >= 1) score = 0.75;
           }
 
           if (!best || score > best.score) {
             best = { key: db.key, required: db.required, score };
           }
         }
 
         if (best && best.score >= 0.75) {
           usedDbKeys.add(best.key);
           return { excelColumn: excelCol, dbColumn: best.key, isSelected: true, isRequired: best.required };
         }
 
         return { excelColumn: excelCol, dbColumn: null, isSelected: false, isRequired: false };
       });

       setColumnMappingsPositivador(autoMappings);
        setShowMappingModalPositivador(true);
    } catch (error) {
      console.error('Erro ao processar arquivo do positivador:', error);
      toast.error("Erro ao processar o arquivo Excel do positivador");
    } finally {
      setIsUploadingPositivador(false);
      if (fileInputRefPositivador.current) {
        fileInputRefPositivador.current.value = '';
      }
    }
  };

  const startUploadPositivador = async () => {
    try {
      setShowConfirmDialogPositivador(false);
      setShowProgressModalPositivador(true);
      setIsUploadingPositivador(true);
      setProgressPercentPositivador(0);
      setProgressInsertedCountPositivador(0);

      const toInsert = preparedRecordsPositivador.filter((r) => !existingKeysSetPositivador?.has(buildRecordKeyPositivador(r)));
      const total = toInsert.length;
      const chunkSize = 500;
      const totalChunks = total > 0 ? Math.ceil(total / chunkSize) : 0;
      const allErrors: string[] = [...prepareErrorsPositivador];
      let insertedCountLocal = 0;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, total);
        const chunk = toInsert.slice(start, end);

        const { data: upserted, error: insertError } = await supabase
          .from('dados_positivador')
          .upsert(chunk, { onConflict: 'assessor,cliente,data_posicao', ignoreDuplicates: true })
          .select('assessor, cliente, data_posicao');

        if (insertError) {
          console.error('Erro ao inserir dados do positivador:', insertError);
          allErrors.push(`Erro do banco ao inserir bloco ${i + 1}/${totalChunks}: ${insertError.message}`);
        } else {
          insertedCountLocal += upserted?.length ?? 0;
          setProgressInsertedCountPositivador(insertedCountLocal);
        }

        setProgressPercentPositivador(totalChunks > 0 ? Math.round(((i + 1) / totalChunks) * 100) : 100);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      setShowProgressModalPositivador(false);

      const chunkErrorsAdded = allErrors.length > prepareErrorsPositivador.length;
      const success = !chunkErrorsAdded;

      setUploadResultPositivador({
        success,
        message: success
          ? `Upload realizado com sucesso! ${insertedCountLocal} registros inseridos. ${duplicateCountPositivador} registro(s) duplicado(s) foram ignorados.`
          : `Upload concluído com erros. Consulte a lista de erros abaixo.`,
        insertedCount: insertedCountLocal,
        errors: allErrors.length > 0 ? allErrors : undefined,
        duplicatesIgnoredCount: duplicateCountPositivador,
        duplicatesSample: duplicatesSampleListPositivador,
      });

      fetchRecentDataPositivador();

      if (success) {
        toast.success(`${insertedCountLocal} registros do positivador importados com sucesso! ${duplicateCountPositivador} duplicado(s) ignorado(s).`);
      } else {
        toast.error(`Upload do positivador concluído com ${allErrors.length - prepareErrorsPositivador.length} erro(s) de inserção.`);
      }
    } catch (error) {
      console.error('Erro no envio do positivador:', error);
      toast.error('Erro inesperado durante o envio do positivador.');
    } finally {
      setIsUploadingPositivador(false);
    }
  };

  useEffect(() => {
    fetchRecentData();
    fetchRecentDataPositivador();
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
                ref={fileInputRefPositivador}
                onChange={handleFileUploadPositivador}
                disabled={isUploadingPositivador}
              />
              <Button
                onClick={() => fileInputRefPositivador.current?.click()}
                disabled={isUploadingPositivador}
                className="w-full"
              >
                {isUploadingPositivador ? (
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
                <strong>Colunas obrigatórias:</strong> assessor, cliente, data_posicao, data_atualizacao
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

      {/* Resultado do Upload de Positivador */}
      {uploadResultPositivador && (
        <Card className="p-6">
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center gap-2">
              {uploadResultPositivador.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <h3 className="font-semibold">Resultado do Upload - Positivador</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <p className="text-sm text-muted-foreground">Registros Importados</p>
                <p className="text-2xl font-bold text-green-400">{uploadResultPositivador.insertedCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-muted-foreground">Erros Encontrados</p>
                <p className="text-2xl font-bold text-red-400">{uploadResultPositivador.errors?.length || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm text-muted-foreground">Duplicados Ignorados</p>
                <p className="text-2xl font-bold text-amber-400">{uploadResultPositivador.duplicatesIgnoredCount || 0}</p>
              </div>
            </div>

            {uploadResultPositivador.errors && uploadResultPositivador.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-400">Erros encontrados:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1 bg-red-500/5 border border-red-500/20 rounded p-3">
                  {uploadResultPositivador.errors.slice(0, 10).map((error, index) => (
                    <p key={index} className="text-sm text-red-300">{error}</p>
                  ))}
                  {uploadResultPositivador.errors.length > 10 && (
                    <p className="text-xs text-red-400">... e mais {uploadResultPositivador.errors.length - 10} erros</p>
                  )}
                </div>
              </div>
            )}

            {uploadResultPositivador.duplicatesSample && uploadResultPositivador.duplicatesSample.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-amber-400">Exemplos de duplicados ignorados:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1 bg-amber-500/5 border border-amber-500/20 rounded p-3">
                  {uploadResultPositivador.duplicatesSample.slice(0, 5).map((duplicate, index) => (
                    <p key={index} className="text-sm text-amber-300">{duplicate}</p>
                  ))}
                  {uploadResultPositivador.duplicatesSample.length > 5 && (
                    <p className="text-xs text-amber-400">... e mais {uploadResultPositivador.duplicatesSample.length - 5} duplicados</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dados Recentes de Positivador */}
      {recentDataPositivador.length > 0 && (
        <Card className="p-6">
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Últimos 10 Registros de Positivador Adicionados</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRecentDataPositivador}
                disabled={isLoadingDataPositivador}
              >
                {isLoadingDataPositivador ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Atualizar'
                )}
              </Button>
            </div>

            {isLoadingDataPositivador ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessor</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Data Posição</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Adicionado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentDataPositivador.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.assessor}</TableCell>
                        <TableCell>{record.cliente}</TableCell>
                        <TableCell>{formatDateDisplay(record.data_posicao)}</TableCell>
                        <TableCell>{record.segmento}</TableCell>
                        <TableCell>{record.status}</TableCell>
                        <TableCell>{formatDateDisplay(record.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Popup de confirmação antes de enviar - Positivador */}
      <AlertDialog open={showConfirmDialogPositivador} onOpenChange={setShowConfirmDialogPositivador}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio - Positivador</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateCountPositivador > 0 ? (
                <>
                  Você está prestes a enviar {Math.max(0, preparedRecordsPositivador.length - duplicateCountPositivador)} linha(s) para o banco de dados.
                  Encontramos {duplicateCountPositivador} registro(s) que já existem e serão ignorados no envio.
                </>
              ) : (
                <>Você está prestes a enviar {preparedRecordsPositivador.length} linha(s) para o banco de dados. Deseja continuar?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {prepareErrorsPositivador.length > 0 && (
            <div className="mt-2 text-sm">
              <p className="text-red-600 font-medium">Linhas inválidas ou com erro: {prepareErrorsPositivador.length}</p>
              <div className="max-h-24 overflow-y-auto mt-2 bg-red-50 border border-red-200 rounded p-2 text-red-700">
                {prepareErrorsPositivador.slice(0, 5).map((err, idx) => (
                  <p key={idx}>{err}</p>
                ))}
                {prepareErrorsPositivador.length > 5 && (
                  <p className="text-xs mt-1">... e mais {prepareErrorsPositivador.length - 5}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={startUploadPositivador} disabled={preparedRecordsPositivador.length === 0}>
              Confirmar e enviar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de progresso durante envio - Positivador */}
      <Dialog open={showProgressModalPositivador}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviando dados - Positivador</DialogTitle>
            <DialogDescription>
              Estamos enviando os registros ao servidor. Por favor, aguarde.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Progresso</span>
              <span className="font-medium">{progressPercentPositivador}%</span>
            </div>
            <Progress value={progressPercentPositivador} />
            <p className="text-sm text-muted-foreground">
              Inseridos: {progressInsertedCountPositivador} de {Math.max(0, preparedRecordsPositivador.length - duplicateCountPositivador)}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Mapeamento de Colunas - Positivador */}
      <ColumnMappingModal
        isOpen={showMappingModalPositivador}
        onClose={() => setShowMappingModalPositivador(false)}
        onConfirm={handleMappingConfirmPositivador}
        excelColumns={excelColumnsPositivador}
        databaseColumns={POSITIVADOR_DATABASE_COLUMNS}
      />
    </div>
  );
}