import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface ColumnMapping {
  excelColumn: string;
  dbColumn: string | null;
  isRequired: boolean;
  isSelected: boolean;
}

interface DatabaseColumn {
  key: string;
  label: string;
  required: boolean;
}

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mapping: ColumnMapping[]) => void;
  excelColumns: string[];
  databaseColumns?: DatabaseColumn[];
}

const DEFAULT_DATABASE_COLUMNS = [
  { key: 'data_captacao', label: 'Data Captação', required: true },
  { key: 'cod_assessor', label: 'Código Assessor', required: true },
  { key: 'cod_cliente', label: 'Código Cliente', required: true },
  { key: 'tipo_captacao', label: 'Tipo Captação', required: true },
  { key: 'aux', label: 'Aux', required: true },
  { key: 'valor_captacao', label: 'Valor Captação', required: true },
  { key: 'data_atualizacao', label: 'Data Atualização', required: true },
  { key: 'tipo_pessoa', label: 'Tipo Pessoa', required: true },
];

export function ColumnMappingModal({ isOpen, onClose, onConfirm, excelColumns, databaseColumns = DEFAULT_DATABASE_COLUMNS }: ColumnMappingModalProps) {
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  // Auto-mapeamento ativado: inicializa mapeamentos com melhor tentativa de correspondência e marca "Importar"
  useEffect(() => {
    if (excelColumns.length > 0) {
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

      // Metadados das colunas do banco (key, label, tokens)
      const dbMeta = databaseColumns.map(db => ({
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

      const initialMappings: ColumnMapping[] = excelColumns.map(excelCol => {
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

      setMappings(initialMappings);
    }
  }, [excelColumns, databaseColumns]);

  const findBestMatch = (excelColumn: string): string | null => {
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

    const n = normalize(excelColumn);
    const excelTokens = tokenize(excelColumn);

    let bestKey: string | null = null;
    let bestScore = 0;

    for (const db of databaseColumns) {
      const keyNorm = normalize(db.key);
      const labelNorm = normalize(db.label);
      const dbTokens = Array.from(new Set([
        ...tokenize(db.label),
        ...db.key.split('_').map(tokenize).flat()
      ]));

      let score = 0;
      if (n === keyNorm) score = 1.0;
      else if (n === labelNorm) score = 0.98;
      else if (n.includes(keyNorm) || keyNorm.includes(n) || n.includes(labelNorm) || labelNorm.includes(n)) score = 0.9;
      else {
        const setExcel = new Set(excelTokens);
        let overlap = 0;
        for (const tk of dbTokens) {
          if (setExcel.has(tk)) overlap++;
        }
        const denom = Math.max(1, Math.max(excelTokens.length, dbTokens.length));
        const jacc = overlap / denom;
        if (jacc >= 0.6) score = 0.85;
        else if (overlap >= 1) score = 0.75;
      }

      if (score > bestScore) {
        bestScore = score;
        bestKey = db.key;
      }
    }

    return bestScore >= 0.75 ? bestKey : null;
  };

  const handleMappingChange = (index: number, dbColumn: string | null) => {
    const newMappings = [...mappings];
    newMappings[index].dbColumn = dbColumn;
    newMappings[index].isRequired = dbColumn ? databaseColumns.find(db => db.key === dbColumn)?.required || false : false;
    setMappings(newMappings);
  };

  const handleSelectionChange = (index: number, isSelected: boolean) => {
    const newMappings = [...mappings];
    newMappings[index].isSelected = isSelected;
    setMappings(newMappings);
  };

  const getAvailableDbColumns = (currentIndex: number) => {
    // Só considerar como "usadas" as colunas que estão selecionadas para importação
    const usedColumns = mappings
      .filter((_, index) => index !== currentIndex)
      .filter(m => m.isSelected) // Só considerar colunas que estão selecionadas para importação
      .map(m => m.dbColumn)
      .filter(Boolean);
    
    return databaseColumns.filter(col => !usedColumns.includes(col.key));
  };

  const validateMappings = () => {
    const selectedMappings = mappings.filter(m => m.isSelected && m.dbColumn);
    const requiredColumns = databaseColumns.filter(col => col.required).map(col => col.key);
    const mappedRequiredColumns = selectedMappings.map(m => m.dbColumn).filter(Boolean);
    
    const missingRequired = requiredColumns.filter(req => !mappedRequiredColumns.includes(req));
    
    return {
      isValid: missingRequired.length === 0,
      missingRequired
    };
  };

  const handleConfirm = () => {
    const validation = validateMappings();
    
    if (!validation.isValid) {
      alert(`Colunas obrigatórias não mapeadas: ${validation.missingRequired.map(col => 
        databaseColumns.find(db => db.key === col)?.label
      ).join(', ')}`);
      return;
    }

    onConfirm(mappings.filter(m => m.isSelected && m.dbColumn));
  };

  const validation = validateMappings();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mapeamento de Colunas</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base text-blue-900">📋 Instruções</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-800">
              <div className="space-y-1">
                <p>• <strong>Selecione</strong> quais colunas do Excel devem ser importadas</p>
                <p>• <strong>Mapeie</strong> cada coluna do Excel para a coluna correspondente no banco de dados</p>
                <p>• Colunas marcadas como <span className="text-red-600 font-semibold">"Obrigatória"</span> devem ser mapeadas para prosseguir</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {mappings.map((mapping, index) => (
              <Card key={index} className={`transition-all duration-200 ${
                mapping.isSelected 
                  ? 'border-green-300 bg-green-50 shadow-md' 
                  : 'border-gray-300 bg-white hover:border-gray-400'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 min-w-[100px]">
                      <Checkbox
                        id={`select-${index}`}
                        checked={mapping.isSelected}
                        onCheckedChange={(checked) => handleSelectionChange(index, checked as boolean)}
                        className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                      />
                      <Label htmlFor={`select-${index}`} className={`text-sm font-semibold ${
                        mapping.isSelected ? 'text-green-800' : 'text-gray-700'
                      }`}>
                        Importar
                      </Label>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Coluna do Excel:
                      </Label>
                      <div className={`font-semibold text-sm mt-1 p-2 rounded-md ${
                        mapping.isSelected 
                          ? 'bg-white text-gray-900 border border-green-200' 
                          : 'bg-gray-100 text-gray-800 border border-gray-200'
                      }`}>
                        {mapping.excelColumn}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Mapear para:
                      </Label>
                      <div className="flex gap-2 mt-1">
                        <Select
                          value={mapping.dbColumn || undefined}
                          onValueChange={(value) => handleMappingChange(index, value || null)}
                          disabled={!mapping.isSelected}
                        >
                          <SelectTrigger className={`${
                            mapping.isSelected 
                              ? 'border-green-300 bg-white text-black' 
                              : 'border-gray-300 bg-gray-50 text-gray-600'
                          }`}>
                            <SelectValue 
                              placeholder="Selecione uma coluna do banco"
                              className="text-black"
                            />
                          </SelectTrigger>
                          <SelectContent className="z-50 bg-white border border-gray-300 shadow-lg">
                            {getAvailableDbColumns(index).map(col => (
                              <SelectItem 
                                key={col.key} 
                                value={col.key}
                                className="cursor-pointer text-black"
                              >
                                <span className="font-medium text-black">{col.label}</span>
                                {col.required && <span className="text-red-600 font-bold ml-1">*</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {mapping.dbColumn && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMappingChange(index, null)}
                            disabled={!mapping.isSelected}
                            className="px-2 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {mapping.isRequired && (
                      <div className="bg-red-100 border border-red-300 rounded-md px-3 py-1">
                        <div className="text-red-700 text-xs font-bold uppercase tracking-wide">
                          Obrigatória
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {!validation.isValid && (
            <Card className="border-red-400 bg-red-50 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-red-600 text-xl">⚠️</div>
                  <div className="text-red-800">
                    <div className="font-bold text-base mb-2">Atenção: Mapeamento Incompleto</div>
                    <p className="text-sm mb-3">As seguintes colunas obrigatórias não foram mapeadas:</p>
                    <ul className="space-y-1">
                      {validation.missingRequired.map(col => (
                        <li key={col} className="flex items-center space-x-2">
                          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                          <span className="font-medium">
                            {databaseColumns.find(db => db.key === col)?.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {validation.isValid && mappings.some(m => m.isSelected) && (
            <Card className="border-green-400 bg-green-50 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="text-green-600 text-xl">✅</div>
                  <div className="text-green-800">
                    <div className="font-bold text-base">Mapeamento Válido</div>
                    <p className="text-sm">
                      {mappings.filter(m => m.isSelected).length} colunas selecionadas para importação
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="space-x-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="hover:bg-gray-100 border-gray-300"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!validation.isValid}
            className={`${
              validation.isValid 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {validation.isValid ? '✓ Confirmar Mapeamento' : 'Mapeamento Incompleto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}