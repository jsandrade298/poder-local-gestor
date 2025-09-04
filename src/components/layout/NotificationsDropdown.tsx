import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bell, BellDot, Check, User, MessageSquare, AlertCircle, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Buscar notificações não lidas
  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ['notificacoes'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      const { data, error } = await supabase
        .from('notificacoes')
        .select(`
          *,
          remetente:remetente_id (
            nome,
            email
          )
        `)
        .eq('destinatario_id', user.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Contagem de notificações não lidas
  const notificacaosPendentes = notificacoes.filter(n => !n.lida).length;

  // Marcar notificação como lida
  const marcarComoLida = useMutation({
    mutationFn: async (notificacaoId: string) => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true, updated_at: new Date().toISOString() })
        .eq('id', notificacaoId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  // Marcar todas como lidas
  const marcarTodasComoLidas = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true, updated_at: new Date().toISOString() })
        .eq('destinatario_id', user.user.id)
        .eq('lida', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
      toast({
        title: "Notificações marcadas",
        description: "Todas as notificações foram marcadas como lidas.",
      });
    },
  });

  // Limpar todas as notificações
  const limparNotificacoes = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('destinatario_id', user.user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
      toast({
        title: "Notificações removidas",
        description: "Todas as notificações foram removidas permanentemente.",
      });
    },
  });

  const handleNotificationClick = (notificacao: any) => {
    // Marcar como lida
    if (!notificacao.lida) {
      marcarComoLida.mutate(notificacao.id);
    }

    // Redirecionar se houver URL destino
    if (notificacao.url_destino) {
      setOpen(false);
      navigate(notificacao.url_destino);
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'mencao':
        return <User className="h-4 w-4" />;
      case 'comentario':
        return <MessageSquare className="h-4 w-4" />;
      case 'atribuicao':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'mencao':
        return 'bg-blue-500';
      case 'comentario':
        return 'bg-green-500';
      case 'atribuicao':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Configurar realtime para notificações
  useEffect(() => {
    const channel = supabase
      .channel('notificacoes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          {notificacaosPendentes > 0 ? (
            <BellDot className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {notificacaosPendentes > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {notificacaosPendentes > 99 ? '99+' : notificacaosPendentes}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 md:w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notificações</h4>
          <div className="flex items-center gap-2">
            {notificacaosPendentes > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => marcarTodasComoLidas.mutate()}
                disabled={marcarTodasComoLidas.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                Marcar como lidas
              </Button>
            )}
            {notificacoes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => limparNotificacoes.mutate()}
                disabled={limparNotificacoes.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar todas
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-80 max-h-[60vh]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando notificações...
            </div>
          ) : notificacoes.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            <div className="p-2">
              {notificacoes.map((notificacao, index) => (
                <div key={notificacao.id}>
                  <Card 
                    className={`mb-2 cursor-pointer transition-colors hover:bg-muted/50 ${
                      !notificacao.lida ? 'border-l-4 border-l-primary' : ''
                    }`}
                    onClick={() => handleNotificationClick(notificacao)}
                  >
                     <CardContent className="p-3">
                       <div className="flex items-start gap-2">
                         <div className={`p-1.5 rounded-full ${getTipoColor(notificacao.tipo)} text-white flex-shrink-0`}>
                           {getTipoIcon(notificacao.tipo)}
                         </div>
                        
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium truncate">
                              {notificacao.titulo}
                            </p>
                            {!notificacao.lida && (
                              <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0 ml-2" />
                            )}
                          </div>
                          
                           <p className="text-xs text-muted-foreground mb-1 break-words overflow-hidden">
                             {notificacao.mensagem.length > 80 ? 
                               `${notificacao.mensagem.substring(0, 80)}...` : 
                               notificacao.mensagem
                             }
                           </p>
                          
                           <div className="flex items-center justify-between text-xs text-muted-foreground">
                             <span className="truncate max-w-[120px]">
                               De: {notificacao.remetente?.nome || 'Sistema'}
                             </span>
                             <span className="flex-shrink-0">
                               {formatDateTime(notificacao.created_at)}
                             </span>
                           </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {index < notificacoes.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}