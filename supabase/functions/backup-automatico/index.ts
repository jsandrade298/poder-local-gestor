import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BackupData {
  timestamp: string;
  demandas: any[];
  municipes: any[];
  areas: any[];
  tags: any[];
  profiles: any[];
  configuracoes: any[];
  user_roles: any[];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando backup automático...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Coletando dados de todas as tabelas principais
    console.log('📊 Coletando dados das tabelas...');
    
    const [
      demandasResult,
      municipesResult, 
      areasResult,
      tagsResult,
      profilesResult,
      configuracoesResult,
      userRolesResult
    ] = await Promise.all([
      supabase.from('demandas').select('*'),
      supabase.from('municipes').select('*'),
      supabase.from('areas').select('*'),
      supabase.from('tags').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('configuracoes').select('*'),
      supabase.from('user_roles').select('*')
    ]);

    // Verificar se houve erros
    const errors = [
      demandasResult.error,
      municipesResult.error,
      areasResult.error,
      tagsResult.error,
      profilesResult.error,
      configuracoesResult.error,
      userRolesResult.error
    ].filter(error => error !== null);

    if (errors.length > 0) {
      console.error('❌ Erros ao coletar dados:', errors);
      throw new Error(`Erro ao coletar dados: ${errors.map(e => e?.message).join(', ')}`);
    }

    // Estruturar dados do backup
    const backupData: BackupData = {
      timestamp: new Date().toISOString(),
      demandas: demandasResult.data || [],
      municipes: municipesResult.data || [],
      areas: areasResult.data || [],
      tags: tagsResult.data || [],
      profiles: profilesResult.data || [],
      configuracoes: configuracoesResult.data || [],
      user_roles: userRolesResult.data || []
    };

    console.log('📦 Dados coletados:', {
      demandas: backupData.demandas.length,
      municipes: backupData.municipes.length,
      areas: backupData.areas.length,
      tags: backupData.tags.length,
      profiles: backupData.profiles.length,
      configuracoes: backupData.configuracoes.length,
      user_roles: backupData.user_roles.length
    });

    // Criar arquivo JSON do backup
    const backupJson = JSON.stringify(backupData, null, 2);
    const backupBlob = new Blob([backupJson], { type: 'application/json' });

    // Nome fixo do arquivo (sempre substitui o anterior)
    const fileName = 'backup-sistema.json';

    // Verificar se já existe um backup e removê-lo
    console.log('🗑️ Removendo backup anterior...');
    const { error: removeError } = await supabase.storage
      .from('demanda-anexos')
      .remove([`backups/${fileName}`]);

    if (removeError && removeError.message !== 'The resource was not found') {
      console.warn('⚠️ Erro ao remover backup anterior:', removeError.message);
    }

    // Fazer upload do novo backup
    console.log('💾 Salvando novo backup...');
    const { error: uploadError } = await supabase.storage
      .from('demanda-anexos')
      .upload(`backups/${fileName}`, backupBlob, {
        contentType: 'application/json',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Erro ao fazer upload do backup:', uploadError);
      throw uploadError;
    }

    console.log('✅ Backup automático concluído com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backup automático concluído com sucesso',
        timestamp: backupData.timestamp,
        totalRecords: Object.values(backupData).reduce((total, records) => {
          return total + (Array.isArray(records) ? records.length : 0);
        }, 0) - 1, // -1 para excluir o timestamp
        fileName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro no backup automático:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});