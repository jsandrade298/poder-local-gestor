import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Loader2, Trash2, FileText, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";
import { BibliotecaDocumentosDialog } from "@/components/forms/BibliotecaDocumentosDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

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

const AssessorIA = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [documentosContexto, setDocumentosContexto] = useState<DocumentoModelo[]>([]);
  const [selectedModel, setSelectedModel] = useState<'gpt-5' | 'gpt-5-mini'>('gpt-5-mini');
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Adicionar mensagem de boas-vindas inicial
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Olá! Sou seu **Assessor Legislativo IA** especializado em redação de documentos oficiais municipais.\n\n📝 **Posso redigir:**\n• Requerimentos de informação\n• Indicações legislativas\n• Projetos de Lei (PLs)\n• Moções\n• Ofícios oficiais\n• Outros documentos legislativos\n\n💡 **Para melhores resultados:** Use a Biblioteca de Documentos para selecionar modelos como referência. Assim posso manter o formato e linguagem adequados aos padrões do seu município.\n\nComo posso ajudá-lo hoje?',
          timestamp: new Date()
        }
      ]);
    }
  }, []);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Preparar histórico da conversa para enviar à IA
      const conversationHistory = messages
        .filter(msg => msg.id !== 'welcome') // Excluir mensagem de boas-vindas
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      // Função para truncar conteúdo (salvaguarda no cliente)
      const truncarConteudo = (texto: string, maxChars: number = 10000): string => {
        if (!texto || texto.length <= maxChars) return texto;
        return texto.substring(0, maxChars) + '\n[... texto truncado no cliente ...]';
      };

      const { data, error } = await supabase.functions.invoke('chat-ia', {
        body: {
          message: userMessage.content,
          conversationHistory,
          model: selectedModel,
          documentosContexto: documentosContexto.map(doc => ({
            nome: doc.nome,
            categoria: doc.categoria,
            conteudo: truncarConteudo(doc.conteudo_extraido || '', 10000)
          }))
        }
      });

      if (error) {
        console.error('Erro ao chamar função:', error);
        throw new Error(error.message || 'Erro ao comunicar com a IA');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar mensagem para a IA",
        variant: "destructive",
      });

      // Adicionar mensagem de erro
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Olá! Sou seu **Assessor Legislativo IA** especializado em redação de documentos oficiais municipais.\n\n📝 **Posso redigir:**\n• Requerimentos de informação\n• Indicações legislativas\n• Projetos de Lei (PLs)\n• Moções\n• Ofícios oficiais\n• Outros documentos legislativos\n\n💡 **Para melhores resultados:** Use a Biblioteca de Documentos para selecionar modelos como referência. Assim posso manter o formato e linguagem adequados aos padrões do seu município.\n\nComo posso ajudá-lo hoje?',
        timestamp: new Date()
      }
    ]);
    toast({
      title: "Conversa limpa",
      description: "O histórico da conversa foi removido.",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleDocumentosSelect = (documentos: DocumentoModelo[]) => {
    setDocumentosContexto(documentos);
  };

  const removerDocumentoContexto = (documentoId: string) => {
    setDocumentosContexto(prev => prev.filter(doc => doc.id !== documentoId));
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <AppHeader />
      
      <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full min-h-0">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Assessor Legislativo IA</h1>
            <p className="text-muted-foreground mt-1">
              Redator especializado em documentos oficiais municipais
            </p>
          </div>
          
          <Button
            variant="outline"
            onClick={clearConversation}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Limpar Chat
          </Button>
        </div>

        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Assessor Legislativo IA
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Modelo:</span>
                  <Select value={selectedModel} onValueChange={(value: 'gpt-5' | 'gpt-5-mini') => setSelectedModel(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                      <SelectItem value="gpt-5">GPT-5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <BibliotecaDocumentosDialog onDocumentosSelect={handleDocumentosSelect} />
              </div>
            </div>
          </CardHeader>
          
          <Separator className="flex-shrink-0" />
          
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground ml-auto'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className={`text-xs mt-1 opacity-70 ${
                        message.role === 'user' ? 'text-primary-foreground' : 'text-muted-foreground'
                      }`}>
                        {formatTimestamp(message.timestamp)}
                      </p>
                    </div>
                    
                    {message.role === 'user' && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Pensando...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            <Separator className="flex-shrink-0" />
            
            <div className="p-4 space-y-3 flex-shrink-0">
              {/* Documentos no Contexto */}
              {documentosContexto.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Documentos no Contexto ({documentosContexto.length}):</span>
                  </div>
                  <div className="w-full overflow-x-auto">
                    <div className="flex gap-3 pb-2">
                      {documentosContexto.map((doc) => (
                        <div
                          key={doc.id}
                          className="relative flex-shrink-0 w-24 h-24 bg-muted rounded-lg border border-border hover:border-primary/50 transition-colors group"
                        >
                          <div className="p-2 h-full flex flex-col items-center justify-between text-center">
                            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                            <span className="text-[10px] font-medium text-foreground leading-tight break-words">
                              {doc.nome.length > 20 ? doc.nome.substring(0, 20) + '...' : doc.nome}
                            </span>
                            <Badge variant="outline" className="text-[9px] py-0 px-1 h-3 truncate max-w-full">
                              {doc.categoria}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removerDocumentoContexto(doc.id)}
                            className="absolute -top-1 -right-1 h-5 w-5 p-0 rounded-full bg-destructive hover:bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Barra de Input */}
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ex: Gerar requerimento de informação sobre obras públicas..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={!inputMessage.trim() || isLoading}
                  size="icon"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Pressione Enter para enviar ou Shift+Enter para quebrar linha
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AssessorIA;