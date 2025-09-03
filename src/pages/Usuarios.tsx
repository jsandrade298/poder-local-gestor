import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, Mail, Phone, Shield, UserCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from '@/lib/dateUtils';

export default function Usuarios() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    nome: "",
    email: "",
    telefone: "",
    cargo: "",
    ativo: true
  });
  const queryClient = useQueryClient();

  // Fetch users with their roles and demandas count
  const { data: usuarios = [], isLoading: isLoadingUsuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      // Fetch profiles with roles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles(role)
        `);

      if (profilesError) throw profilesError;

      // Fetch demandas count for each user
      const { data: demandasData, error: demandasError } = await supabase
        .from('demandas')
        .select('criado_por, responsavel_id');

      if (demandasError) throw demandasError;

      // Count demandas by user
      const demandasCount = demandasData.reduce((acc, demanda) => {
        if (demanda.criado_por) {
          acc[demanda.criado_por] = (acc[demanda.criado_por] || 0) + 1;
        }
        if (demanda.responsavel_id && demanda.responsavel_id !== demanda.criado_por) {
          acc[demanda.responsavel_id] = (acc[demanda.responsavel_id] || 0) + 1;
        }
        return acc;
      }, {});

      // Combine profiles with demandas count and roles
      return profilesData.map(profile => ({
        ...profile,
        total_demandas: demandasCount[profile.id] || 0,
        role: profile.user_roles?.[0]?.role || 'usuario',
        ativo: true // Por enquanto consideramos todos ativos, pode ser ajustado conforme necessário
      }));
    }
  });

  // Create user mutation (placeholder - requires auth implementation)
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      // This would need proper auth implementation to create users
      // For now, we'll just show a message
      throw new Error("Criação de usuários requer implementação de autenticação completa");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({
        title: "Usuário criado",
        description: "O usuário foi criado com sucesso.",
      });
      setIsCreateDialogOpen(false);
      setNewUser({ nome: "", email: "", telefone: "", cargo: "", ativo: true });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const filteredUsuarios = useMemo(() => {
    return usuarios.filter(usuario => {
      const matchesSearch = usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           usuario.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
                           (statusFilter === "ativo" && usuario.ativo) ||
                           (statusFilter === "inativo" && !usuario.ativo);
      
      return matchesSearch && matchesStatus;
    });
  }, [usuarios, searchTerm, statusFilter]);

  const handleCreateUser = () => {
    if (!newUser.nome.trim() || !newUser.email.trim()) return;
    
    createUserMutation.mutate(newUser);
  };

  const usuariosAtivos = usuarios.filter(u => u.ativo).length;
  const totalDemandas = usuarios.reduce((acc, u) => acc + u.total_demandas, 0);

  if (isLoadingUsuarios) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Carregando usuários...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Gestão de Usuários
          </h1>
          <p className="text-muted-foreground">
            Gerencie os usuários do sistema
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  placeholder="Nome do usuário"
                  value={newUser.nome}
                  onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@gabinete.gov.br"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  placeholder="(11) 99999-9999"
                  value={newUser.telefone}
                  onChange={(e) => setNewUser({ ...newUser, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo</Label>
                <Input
                  id="cargo"
                  placeholder="Ex: Analista, Coordenador..."
                  value={newUser.cargo}
                  onChange={(e) => setNewUser({ ...newUser, cargo: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={newUser.ativo}
                  onCheckedChange={(checked) => setNewUser({ ...newUser, ativo: checked })}
                />
                <Label htmlFor="ativo">Usuário ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateUser} 
                disabled={!newUser.nome.trim() || !newUser.email.trim() || createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <div>
                <div className="text-2xl font-bold text-foreground">{usuarios.length}</div>
                <p className="text-sm text-muted-foreground">Total de Usuários</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-success">{usuariosAtivos}</div>
            <p className="text-sm text-muted-foreground">Usuários Ativos</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-destructive">{usuarios.length - usuariosAtivos}</div>
            <p className="text-sm text-muted-foreground">Usuários Inativos</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{totalDemandas}</div>
            <p className="text-sm text-muted-foreground">Demandas Atribuídas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Status
              </label>
              <select 
                className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos os status</option>
                <option value="ativo">Apenas ativos</option>
                <option value="inativo">Apenas inativos</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Ações
              </label>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                }}
              >
                <Search className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Usuários */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Usuários ({filteredUsuarios.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Demandas</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsuarios.map((usuario) => (
                  <TableRow key={usuario.id}>
                     <TableCell>
                       <div>
                         <p className="font-medium text-foreground">{usuario.nome}</p>
                         <p className="text-xs text-muted-foreground">
                           Cadastrado em {formatDateTime(usuario.created_at).split(' ')[0]}
                         </p>
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="space-y-1">
                         <div className="flex items-center gap-1">
                           <Mail className="h-3 w-3 text-muted-foreground" />
                           <span className="text-xs text-foreground">{usuario.email}</span>
                         </div>
                         {usuario.telefone && (
                           <div className="flex items-center gap-1">
                             <Phone className="h-3 w-3 text-muted-foreground" />
                             <span className="text-xs text-foreground">{usuario.telefone}</span>
                           </div>
                         )}
                       </div>
                     </TableCell>
                    <TableCell>
                      <Badge variant={usuario.ativo ? "default" : "destructive"}>
                        {usuario.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                     <TableCell>
                       <div className="flex items-center gap-1">
                         <Shield className="h-3 w-3 text-muted-foreground" />
                         <Badge variant={
                           usuario.role === 'admin' ? 'destructive' : 
                           usuario.role === 'gestor' ? 'default' : 
                           usuario.role === 'atendente' ? 'secondary' : 'outline'
                         }>
                           {usuario.role === 'admin' ? 'Admin' : 
                            usuario.role === 'gestor' ? 'Gestor' :
                            usuario.role === 'atendente' ? 'Atendente' : 'Usuário'}
                         </Badge>
                       </div>
                     </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {usuario.total_demandas}
                      </Badge>
                    </TableCell>
                     <TableCell>
                       <span className="text-sm text-foreground">
                         {formatDateTime(usuario.updated_at).split(' ')[0]}
                       </span>
                     </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem>Ver Demandas</DropdownMenuItem>
                          <DropdownMenuItem>Reset Senha</DropdownMenuItem>
                          <DropdownMenuItem className={usuario.ativo ? "text-destructive" : "text-success"}>
                            {usuario.ativo ? "Desativar" : "Ativar"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredUsuarios.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}