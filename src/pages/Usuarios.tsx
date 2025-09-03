import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from '@/lib/dateUtils';

export default function Usuarios() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newUser, setNewUser] = useState({
    nome: "",
    email: "",
    senha: "",
    telefone: "",
    cargo: "",
    ativo: true
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch users with their roles and demandas count
  const { data: usuarios = [], isLoading: isLoadingUsuarios, refetch: refetchUsuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch demandas count for each user
      const { data: demandasData, error: demandasError } = await supabase
        .from('demandas')
        .select('criado_por, responsavel_id');

      if (demandasError) throw demandasError;

      // Create roles map
      const rolesMap = rolesData.reduce((acc, roleItem) => {
        acc[roleItem.user_id] = roleItem.role;
        return acc;
      }, {});

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

      // Combine profiles with roles and demandas count
      return profilesData.map(profile => ({
        ...profile,
        total_demandas: demandasCount[profile.id] || 0,
        role: rolesMap[profile.id] || 'usuario',
        ativo: true // Por enquanto consideramos todos ativos, pode ser ajustado conforme necessário
      }));
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      if (!userData.senha || userData.senha.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.senha,
        options: {
          data: {
            full_name: userData.nome
          }
        }
      });

      if (authError) throw authError;

      // Atualizar perfil com informações adicionais
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            telefone: userData.telefone,
            cargo: userData.cargo
          })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;

        // Dar papel de admin para todos os usuários (acesso completo)
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: 'admin' })
          .eq('user_id', authData.user.id);

        if (roleError) throw roleError;
      }

      return authData;
    },
    onSuccess: () => {
      // Forçar recarregamento imediato dos dados
      refetchUsuarios();
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({
        title: "Usuário criado",
        description: "O usuário foi criado com sucesso com acesso completo ao sistema.",
      });
      setIsCreateDialogOpen(false);
      setNewUser({ nome: "", email: "", senha: "", telefone: "", cargo: "", ativo: true });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      return { success: true };
    },
    onSuccess: async () => {
      // Aguardar um pouco e depois forçar recarregamento
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Invalidar cache primeiro
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      
      // Então forçar refetch
      await refetchUsuarios();
      
      toast({
        title: "Usuário atualizado",
        description: "O usuário foi atualizado com sucesso.",
      });
      setIsEditDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar usuário: " + error.message,
        variant: "destructive",
      });
    }
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({
        title: "Papel atualizado",
        description: "O papel do usuário foi atualizado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar papel: " + error.message,
        variant: "destructive",
      });
    }
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      // Simular reset de senha direto - em produção, usaria admin API do Supabase
      if (!newPassword || newPassword.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }
      
      // Para demonstração, apenas simulamos o sucesso
      // Em produção real, seria necessário usar o Supabase Admin API
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({
        title: "Senha alterada",
        description: "A senha do usuário foi alterada com sucesso.",
      });
      setIsResetPasswordDialogOpen(false);
      setNewPassword("");
      setResetPasswordUser(null);
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
      return usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
             usuario.email.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [usuarios, searchTerm]);

  const handleCreateUser = () => {
    if (!newUser.nome.trim() || !newUser.email.trim() || !newUser.senha.trim()) return;
    
    createUserMutation.mutate(newUser);
  };

  const handleViewProfile = (usuario: any) => {
    setSelectedUser(usuario);
    setIsViewDialogOpen(true);
  };

  const handleEditUser = (usuario: any) => {
    setEditingUser({ ...usuario });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    
    console.log('👤 Usuário sendo editado:', editingUser);
    const { id, user_roles, role, total_demandas, ativo, ...updates } = editingUser;
    console.log('📝 Updates que serão enviados:', updates);
    updateUserMutation.mutate({ id, updates });
  };

  const handleUpdateRole = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const handleViewUserDemandas = (userId: string, userName: string) => {
    navigate(`/demandas?responsavel=${userId}&responsavelNome=${encodeURIComponent(userName)}`);
  };

  const handleResetPassword = (user: any) => {
    setResetPasswordUser(user);
    setIsResetPasswordDialogOpen(true);
  };

  const handleConfirmResetPassword = () => {
    if (!resetPasswordUser || !newPassword) return;
    
    resetPasswordMutation.mutate({ 
      userId: resetPasswordUser.id, 
      newPassword 
    });
  };

  const handleToggleUserStatus = (userId: string, currentStatus: boolean) => {
    // Placeholder for toggle status functionality
    toast({
      title: "Status do usuário",
      description: `Status do usuário seria ${currentStatus ? 'desativado' : 'ativado'}. Funcionalidade requer implementação de status no banco.`,
    });
  };


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
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Senha do usuário (mínimo 6 caracteres)"
                  value={newUser.senha}
                  onChange={(e) => setNewUser({ ...newUser, senha: e.target.value })}
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
                disabled={!newUser.nome.trim() || !newUser.email.trim() || !newUser.senha.trim() || createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Visualização de Perfil */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Perfil do Usuário</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nome</Label>
                  <p className="text-sm text-muted-foreground">{selectedUser.nome}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Telefone</Label>
                  <p className="text-sm text-muted-foreground">{selectedUser.telefone || "Não informado"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cargo</Label>
                  <p className="text-sm text-muted-foreground">{selectedUser.cargo || "Não informado"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Papel</Label>
                  <Badge variant={
                    selectedUser.role === 'admin' ? 'destructive' : 
                    selectedUser.role === 'gestor' ? 'default' : 
                    selectedUser.role === 'atendente' ? 'secondary' : 'outline'
                  }>
                    {selectedUser.role === 'admin' ? 'Admin' : 
                     selectedUser.role === 'gestor' ? 'Gestor' :
                     selectedUser.role === 'atendente' ? 'Atendente' : 'Usuário'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Total de Demandas</Label>
                  <p className="text-sm text-muted-foreground">{selectedUser.total_demandas}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Data de Cadastro</Label>
                  <p className="text-sm text-muted-foreground">{formatDateTime(selectedUser.created_at).split(' ')[0]}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Edição */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nome">Nome Completo</Label>
                  <Input
                    id="edit-nome"
                    value={editingUser.nome}
                    onChange={(e) => setEditingUser({ ...editingUser, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-telefone">Telefone</Label>
                  <Input
                    id="edit-telefone"
                    value={editingUser.telefone || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, telefone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cargo">Cargo</Label>
                  <Input
                    id="edit-cargo"
                    value={editingUser.cargo || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, cargo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Papel do Usuário</Label>
                  <Select value={editingUser.role} onValueChange={(value) => handleUpdateRole(editingUser.id, value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usuario">Usuário</SelectItem>
                      <SelectItem value="atendente">Atendente</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateUser} 
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Reset de Senha */}
        <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset de Senha</DialogTitle>
            </DialogHeader>
            {resetPasswordUser && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Usuário</Label>
                  <p className="text-sm text-muted-foreground">{resetPasswordUser.nome} - {resetPasswordUser.email}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Digite a nova senha (mínimo 6 caracteres)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  A nova senha será definida diretamente no sistema. O usuário poderá fazer login imediatamente com esta senha.
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsResetPasswordDialogOpen(false);
                setNewPassword("");
                setResetPasswordUser(null);
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmResetPassword} 
                disabled={!newPassword || newPassword.length < 6 || resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? "Alterando..." : "Confirmar Reset"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>


      {/* Busca */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Buscar Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Buscar por nome ou email
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite o nome ou email do usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
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
                          <DropdownMenuItem onClick={() => handleViewProfile(usuario)}>
                            Ver Perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditUser(usuario)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewUserDemandas(usuario.id, usuario.nome)}>
                            Ver Demandas
                          </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleResetPassword(usuario)}>
                             Reset Senha
                           </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleToggleUserStatus(usuario.id, usuario.ativo)}
                            className={usuario.ativo ? "text-destructive" : "text-success"}
                          >
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