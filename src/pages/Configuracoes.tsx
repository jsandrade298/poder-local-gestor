import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Upload, Palette, ExternalLink, Building, Users, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConfiguracoes } from "@/hooks/useConfiguracoes";

export default function Configuracoes() {
  const { toast } = useToast();
  const { 
    loading, 
    updateMultipleConfiguracoes, 
    getGabineteConfig, 
    getTemaConfig, 
    getRedesSociaisConfig, 
    getSistemaConfig 
  } = useConfiguracoes();
  
  const [isLoading, setIsLoading] = useState(false);
  
  // Estado das configurações carregado do Supabase
  const [config, setConfig] = useState({
    gabinete: getGabineteConfig(),
    tema: getTemaConfig(),
    redes_sociais: getRedesSociaisConfig(),
    sistema: getSistemaConfig()
  });

  // Atualizar estado quando os dados carregarem
  useEffect(() => {
    if (!loading) {
      setConfig({
        gabinete: getGabineteConfig(),
        tema: getTemaConfig(),
        redes_sociais: getRedesSociaisConfig(),
        sistema: getSistemaConfig()
      });
    }
  }, [loading, getGabineteConfig, getTemaConfig, getRedesSociaisConfig, getSistemaConfig]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Preparar dados para envio ao Supabase
      const updates = {
        // Gabinete
        'gabinete_nome': config.gabinete.nome,
        'gabinete_email': config.gabinete.email,
        'gabinete_descricao': config.gabinete.descricao,
        'gabinete_endereco': config.gabinete.endereco,
        'gabinete_telefone': config.gabinete.telefone,
        
        // Tema
        'cor_primaria': config.tema.cor_primaria,
        'cor_secundaria': config.tema.cor_secundaria,
        'logo_url': config.tema.logo_url,
        
        // Redes Sociais
        'whatsapp_url': config.redes_sociais.whatsapp,
        'instagram_url': config.redes_sociais.instagram,
        'facebook_url': config.redes_sociais.facebook,
        'twitter_url': config.redes_sociais.twitter,
        
        // Sistema
        'timezone': config.sistema.timezone,
        'formato_data': config.sistema.formato_data,
        'limite_upload_mb': config.sistema.limite_upload_mb.toString(),
        'backup_automatico': config.sistema.backup_automatico.toString()
      };
      
      const { error } = await updateMultipleConfiguracoes(updates);
      
      if (error) {
        throw new Error(error);
      }
      
      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (section: string, field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Configurações do Sistema
          </h1>
          <p className="text-muted-foreground">
            Gerencie as configurações gerais do gabinete
          </p>
        </div>
        
        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="h-4 w-4 mr-2" />
          {isLoading ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>

      {/* Status do Sistema */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Status do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Sistema</span>
              <Badge variant="default">Online</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Banco de Dados</span>
              <Badge variant="default">Conectado</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Última Atualização</span>
              <span className="text-sm text-muted-foreground">10/01/2024 14:30</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados do Gabinete */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building className="h-4 w-4" />
            Dados do Gabinete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome_gabinete">Nome do Gabinete</Label>
              <Input
                id="nome_gabinete"
                value={config.gabinete.nome}
                onChange={(e) => handleInputChange('gabinete', 'nome', e.target.value)}
                placeholder="Nome oficial do gabinete"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email_gabinete">Email Oficial</Label>
              <Input
                id="email_gabinete"
                type="email"
                value={config.gabinete.email}
                onChange={(e) => handleInputChange('gabinete', 'email', e.target.value)}
                placeholder="contato@gabinete.gov.br"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="descricao_gabinete">Descrição</Label>
            <Textarea
              id="descricao_gabinete"
              value={config.gabinete.descricao}
              onChange={(e) => handleInputChange('gabinete', 'descricao', e.target.value)}
              placeholder="Breve descrição da atuação do gabinete"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endereco_gabinete">Endereço</Label>
              <Input
                id="endereco_gabinete"
                value={config.gabinete.endereco}
                onChange={(e) => handleInputChange('gabinete', 'endereco', e.target.value)}
                placeholder="Endereço completo"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="telefone_gabinete">Telefone</Label>
              <Input
                id="telefone_gabinete"
                value={config.gabinete.telefone}
                onChange={(e) => handleInputChange('gabinete', 'telefone', e.target.value)}
                placeholder="(11) 3333-4444"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tema e Aparência */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Tema e Aparência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cor_primaria">Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  id="cor_primaria"
                  type="color"
                  value={config.tema.cor_primaria}
                  onChange={(e) => handleInputChange('tema', 'cor_primaria', e.target.value)}
                  className="w-16 h-10 p-1 border"
                />
                <Input
                  value={config.tema.cor_primaria}
                  onChange={(e) => handleInputChange('tema', 'cor_primaria', e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cor_secundaria">Cor Secundária</Label>
              <div className="flex gap-2">
                <Input
                  id="cor_secundaria"
                  type="color"
                  value={config.tema.cor_secundaria}
                  onChange={(e) => handleInputChange('tema', 'cor_secundaria', e.target.value)}
                  className="w-16 h-10 p-1 border"
                />
                <Input
                  value={config.tema.cor_secundaria}
                  onChange={(e) => handleInputChange('tema', 'cor_secundaria', e.target.value)}
                  placeholder="#10b981"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          
          <div className="border-t border-border my-4" />
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo do Gabinete</Label>
              <div className="flex gap-2">
                <Input
                  id="logo_url"
                  value={config.tema.logo_url}
                  onChange={(e) => handleInputChange('tema', 'logo_url', e.target.value)}
                  placeholder="URL da logo ou deixe vazio"
                  className="flex-1"
                />
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Recomendado: PNG ou SVG, máximo 200px de altura
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redes Sociais */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Redes Sociais e Contatos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={config.redes_sociais.whatsapp}
                onChange={(e) => handleInputChange('redes_sociais', 'whatsapp', e.target.value)}
                placeholder="+5511999999999"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={config.redes_sociais.instagram}
                onChange={(e) => handleInputChange('redes_sociais', 'instagram', e.target.value)}
                placeholder="https://instagram.com/usuario"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="facebook">Facebook</Label>
              <Input
                id="facebook"
                value={config.redes_sociais.facebook}
                onChange={(e) => handleInputChange('redes_sociais', 'facebook', e.target.value)}
                placeholder="https://facebook.com/usuario"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="twitter">Twitter/X</Label>
              <Input
                id="twitter"
                value={config.redes_sociais.twitter}
                onChange={(e) => handleInputChange('redes_sociais', 'twitter', e.target.value)}
                placeholder="https://twitter.com/usuario"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações do Sistema */}
      <Card className="shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Configurações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Fuso Horário</Label>
              <select 
                id="timezone"
                className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                value={config.sistema.timezone}
                onChange={(e) => handleInputChange('sistema', 'timezone', e.target.value)}
              >
                <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                <option value="America/Manaus">Manaus (GMT-4)</option>
                <option value="America/Rio_Branco">Acre (GMT-5)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="limite_upload">Limite Upload (MB)</Label>
              <Input
                id="limite_upload"
                type="number"
                value={config.sistema.limite_upload_mb}
                onChange={(e) => handleInputChange('sistema', 'limite_upload_mb', e.target.value)}
                min="1"
                max="100"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="formato_data">Formato de Data</Label>
              <select 
                id="formato_data"
                className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                value={config.sistema.formato_data}
                onChange={(e) => handleInputChange('sistema', 'formato_data', e.target.value)}
              >
                <option value="DD/MM/AAAA">DD/MM/AAAA</option>
                <option value="MM/DD/AAAA">MM/DD/AAAA</option>
                <option value="AAAA-MM-DD">AAAA-MM-DD</option>
              </select>
            </div>
          </div>
          
          <div className="border-t border-border my-4" />
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-foreground">Backup Automático</h4>
              <p className="text-xs text-muted-foreground">
                Realizar backup diário dos dados automaticamente
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.sistema.backup_automatico}
              onChange={(e) => handleInputChange('sistema', 'backup_automatico', e.target.checked.toString())}
              className="h-4 w-4"
            />
          </div>
        </CardContent>
      </Card>

      {/* Botão de Salvar Final */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {isLoading ? "Salvando..." : "Salvar Todas as Configurações"}
        </Button>
      </div>
    </div>
  );
}