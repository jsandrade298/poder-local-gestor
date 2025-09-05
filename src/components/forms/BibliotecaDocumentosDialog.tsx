import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, Trash2, Eye, Library } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { CategoriaDialog } from './CategoriaDialog';

interface DocumentoModelo {
  id: string;
  nome: string;
  categoria: string;
  tipo_arquivo: string;
  tamanho_arquivo: number;
  url_arquivo: string;
  conteudo_extraido: string;
  created_at: string;
}

interface BibliotecaDocumentosDialogProps {
  onDocumentosSelect: (documentos: DocumentoModelo[]) => void;
}

const CATEGORIAS_DOCUMENTO = [
  'Requerimento',
  'Indicação',
  'Projeto de Lei',
  'Moção',
  'Ofício',
  'Parecer',
  'Relatório',
  'Outros'
];

export const BibliotecaDocumentosDialog = ({ onDocumentosSelect }: BibliotecaDocumentosDialogProps) => {
  const [open, setOpen] = useState(false);
  const [documentos, setDocumentos] = useState<DocumentoModelo[]>([]);
  const [documentosSelecionados, setDocumentosSelecionados] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [arquivosPendentes, setArquivosPendentes] = useState<FileList | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const carregarDocumentos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documentos_modelo')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocumentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os documentos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const extrairTextoArquivo = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Para arquivos TXT, retorna o conteúdo diretamente
        if (file.type === 'text/plain') {
          resolve(text);
        } else {
          // Para outros tipos, extrai texto básico (implementação simples)
          resolve(text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim());
        }
      };
      reader.readAsText(file);
    });
  };

  const sanitizarNomeArquivo = (nome: string): string => {
    return nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Substitui caracteres especiais por underscore
      .replace(/_+/g, '_') // Remove underscores duplicados
      .toLowerCase();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !user) return;

    // Armazenar arquivos e abrir modal de categoria
    setArquivosPendentes(files);
    setCategoriaDialogOpen(true);
  };

  const processarUpload = async (categoria: string) => {
    if (!arquivosPendentes || !user) return;

    setUploadProgress(true);

    for (const file of Array.from(arquivosPendentes)) {
      try {
        // Validar tipo de arquivo
        const tiposPermitidos = ['application/pdf', 'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        
        if (!tiposPermitidos.includes(file.type)) {
          toast({
            title: "Tipo de arquivo não suportado",
            description: "Apenas PDF, DOC, DOCX e TXT são permitidos.",
            variant: "destructive",
          });
          continue;
        }

        // Upload do arquivo com nome sanitizado
        const nomeArquivoSanitizado = sanitizarNomeArquivo(file.name);
        const nomeArquivo = `${user.id}/${Date.now()}-${nomeArquivoSanitizado}`;
        const { error: uploadError } = await supabase.storage
          .from('documentos-modelo')
          .upload(nomeArquivo, file);

        if (uploadError) throw uploadError;

        // Obter URL do arquivo
        const { data: urlData } = supabase.storage
          .from('documentos-modelo')
          .getPublicUrl(nomeArquivo);

        // Extrair texto do arquivo
        let conteudoExtraido = '';
        try {
          conteudoExtraido = await extrairTextoArquivo(file);
        } catch (error) {
          console.warn('Não foi possível extrair texto do arquivo:', error);
        }

        // Salvar metadados no banco
        const { error: dbError } = await supabase
          .from('documentos_modelo')
          .insert({
            nome: file.name,
            categoria: categoria,
            tipo_arquivo: file.type,
            tamanho_arquivo: file.size,
            url_arquivo: urlData.publicUrl,
            conteudo_extraido: conteudoExtraido,
            uploaded_by: user.id
          });

        if (dbError) throw dbError;

        toast({
          title: "Sucesso",
          description: `${file.name} foi adicionado à biblioteca.`,
        });

      } catch (error) {
        console.error('Erro no upload:', error);
        toast({
          title: "Erro no upload",
          description: `Falha ao enviar ${file.name}.`,
          variant: "destructive",
        });
      }
    }

    setUploadProgress(false);
    setArquivosPendentes(null);
    carregarDocumentos();
    
    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDocumentoToggle = (documentoId: string) => {
    setDocumentosSelecionados(prev => 
      prev.includes(documentoId) 
        ? prev.filter(id => id !== documentoId)
        : [...prev, documentoId]
    );
  };

  const handleConfirmarSelecao = () => {
    const documentosParaEnviar = documentos.filter(doc => 
      documentosSelecionados.includes(doc.id)
    );
    onDocumentosSelect(documentosParaEnviar);
    setOpen(false);
    setDocumentosSelecionados([]);
    
    toast({
      title: "Documentos selecionados",
      description: `${documentosParaEnviar.length} documento(s) adicionado(s) ao contexto.`,
    });
  };

  const handleRemoverDocumento = async (documentoId: string) => {
    try {
      const { error } = await supabase
        .from('documentos_modelo')
        .update({ ativo: false })
        .eq('id', documentoId);

      if (error) throw error;

      toast({
        title: "Documento removido",
        description: "O documento foi removido da biblioteca.",
      });

      carregarDocumentos();
    } catch (error) {
      console.error('Erro ao remover documento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o documento.",
        variant: "destructive",
      });
    }
  };

  const formatarTamanho = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const tamanhos = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + tamanhos[i];
  };

  const agruparPorCategoria = (docs: DocumentoModelo[]) => {
    return docs.reduce((grupos, doc) => {
      const categoria = doc.categoria;
      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }
      grupos[categoria].push(doc);
      return grupos;
    }, {} as Record<string, DocumentoModelo[]>);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={carregarDocumentos}
          className="gap-2"
        >
          <Library className="h-4 w-4" />
          Biblioteca de Documentos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Biblioteca de Documentos Modelo
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Gerencie documentos modelo para usar como base na criação de novos documentos com a IA.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Adicionar Novos Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button 
                  onClick={handleFileSelect}
                  disabled={uploadProgress}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploadProgress ? 'Enviando...' : 'Selecionar Arquivos'}
                </Button>
                <span className="text-sm text-muted-foreground self-center">
                  PDF, DOC, DOCX, TXT
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Lista de Documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Selecionar Documentos para Contexto
                {documentosSelecionados.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {documentosSelecionados.length} selecionado(s)
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                {loading ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Carregando documentos...
                  </div>
                ) : Object.keys(agruparPorCategoria(documentos)).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum documento encontrado.</p>
                    <p className="text-sm">Faça upload dos primeiros documentos modelo.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(agruparPorCategoria(documentos)).map(([categoria, docs]) => (
                      <div key={categoria}>
                        <h4 className="font-medium text-sm text-muted-foreground mb-2">
                          {categoria}
                        </h4>
                        <div className="space-y-2 ml-2">
                          {docs.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-2 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={documentosSelecionados.includes(doc.id)}
                                  onCheckedChange={() => handleDocumentoToggle(doc.id)}
                                />
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium text-sm">{doc.nome}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatarTamanho(doc.tamanho_arquivo)} • {new Date(doc.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(doc.url_arquivo, '_blank')}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoverDocumento(doc.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

        </div>

        {/* Botões de Ação */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmarSelecao}
            disabled={documentosSelecionados.length === 0}
          >
            Usar {documentosSelecionados.length} Documento(s) no Contexto
          </Button>
        </div>
      </DialogContent>

      {/* Modal de Categoria */}
      <CategoriaDialog
        open={categoriaDialogOpen}
        onOpenChange={setCategoriaDialogOpen}
        onConfirm={processarUpload}
      />
    </Dialog>
  );
};