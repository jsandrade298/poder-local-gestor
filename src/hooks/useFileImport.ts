import { useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export interface ImportResult {
  success: boolean;
  titulo: string;
  error?: string;
  id?: string;
}

export interface ParsedData {
  headers: string[];
  rows: string[][];
}

export const useFileImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);

  const parseFile = async (file: File): Promise<ParsedData> => {
    return new Promise((resolve, reject) => {
      const fileName = file.name.toLowerCase();
      const isXLSX = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
      const isCSV = fileName.endsWith('.csv');

      if (!isXLSX && !isCSV) {
        reject(new Error('Formato de arquivo não suportado. Use CSV ou XLSX.'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          let data: string[][];

          if (isXLSX) {
            console.log('📊 Processando arquivo XLSX...');
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            data = XLSX.utils.sheet_to_json(worksheet, { 
              header: 1, 
              defval: '', 
              blankrows: false 
            }) as string[][];
            
            console.log(`✅ XLSX processado: ${data.length} linhas`);
          } else {
            console.log('📄 Processando arquivo CSV...');
            const csvText = e.target?.result as string;
            
            // Detectar separador
            const firstLine = csvText.split('\n')[0];
            const separators = [',', ';', '\t'];
            let bestSeparator = ',';
            let maxFields = 0;
            
            for (const sep of separators) {
              const fields = firstLine.split(sep);
              if (fields.length > maxFields) {
                maxFields = fields.length;
                bestSeparator = sep;
              }
            }
            
            console.log(`🔍 Separador detectado: "${bestSeparator}"`);
            
            // Processar CSV
            const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
            data = lines.map(line => {
              return line.split(bestSeparator).map(field => {
                let clean = field.trim();
                if ((clean.startsWith('"') && clean.endsWith('"')) || 
                    (clean.startsWith("'") && clean.endsWith("'"))) {
                  clean = clean.slice(1, -1);
                }
                return clean;
              });
            });
            
            console.log(`✅ CSV processado: ${data.length} linhas`);
          }

          if (data.length < 2) {
            reject(new Error('O arquivo deve ter pelo menos uma linha de cabeçalho e uma linha de dados.'));
            return;
          }

          const headers = data[0].map(h => h.toLowerCase().trim());
          const rows = data.slice(1);

          console.log(`📊 Headers: ${headers.join(', ')}`);
          console.log(`📊 ${rows.length} linhas de dados processadas`);

          resolve({
            headers,
            rows
          });
          
        } catch (error) {
          console.error('Erro ao processar arquivo:', error);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo'));
      };

      if (isXLSX) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file, 'UTF-8');
      }
    });
  };

  const clearResults = () => {
    setImportResults([]);
  };

  return {
    isImporting,
    setIsImporting,
    importResults,
    setImportResults,
    parseFile,
    clearResults
  };
};