import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizePhone(phone: string): string {
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const numero = digits.slice(2);
    if (/^[987]/.test(numero)) digits = ddd + "9" + numero;
  }
  return "55" + digits;
}

function substituirVariaveis(texto: string, variaveis: Record<string, string>): string {
  if (!texto) return texto;
  let resultado = texto;
  Object.entries(variaveis).forEach(([chave, valor]) => {
    const regex = new RegExp(`\\{${chave}\\}`, 'gi');
    resultado = resultado.replace(regex, valor ?? '');
  });
  return resultado;
}

function calcularDelayTyping(mensagem: string): number {
  return Math.min(Math.max(Math.ceil(mensagem.length / 50), 2), 50);
}

function embaralharArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function callZApi(
  instanceId: string, token: string, clientToken: string,
  endpoint: string, payload: any
): Promise<{ ok: boolean; body: any; error?: string }> {
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`;
  
  try {
    console.log(`🔄 Z-API: ${endpoint}`);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify(payload)
    });
    
    const text = await response.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}
    
    if (!response.ok) {
      return { ok: false, body, error: body?.error || body?.message || `HTTP ${response.status}` };
    }
    return { ok: true, body };
  } catch (error: any) {
    return { ok: false, body: null, error: error.message };
  }
}

function detectMediaType(media: any): string {
  const mimeType = media.mimetype || '';
  const shortType = media.type || '';
  const filename = (media.filename || media.fileName || '').toLowerCase();
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/')) return 'document';
  
  if (['image', 'video', 'audio', 'document'].includes(shortType)) return shortType;
  
  if (/\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|svg)$/.test(filename)) return 'image';
  if (/\.(mp4|avi|mov|webm|mkv|3gp)$/.test(filename)) return 'video';
  if (/\.(mp3|ogg|wav|m4a|opus|aac|wma)$/.test(filename)) return 'audio';
  return 'document';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const requestData = await req.json();
    
    const {
      destinatarios = [],
      telefones = [],
      mensagem = "",
      incluirTodos = false,
      instanceName,
      tempoMinimo = 2,
      tempoMaximo = 5,
      mediaFiles = [],
      customMessages = {},
      tipo = 'texto',
      conteudo = {},
      localizacao,
      contato,
      enquete,
      ordemAleatoria = false,
      reacaoAutomatica = null,
      salvarHistorico = true,
      tituloEnvio = '',
      envioId: envioIdExterno = null,
      // MULTI-TENANT: tenant_id pode vir do body (chamadas internas)
      tenant_id: tenantIdParam = null,
    } = requestData;

    console.log("=== ENVIO WHATSAPP Z-API (MULTI-TENANT) ===");
    console.log("📋 Destinatários (novo):", destinatarios.length);
    console.log("📋 Telefones (antigo):", telefones.length);
    console.log("📋 Incluir todos:", incluirTodos);
    console.log("📋 EnvioId externo:", envioIdExterno);
    console.log("📋 Tipo:", tipo);
    console.log("📎 MediaFiles:", mediaFiles.length);

    // ============================================================
    // MULTI-TENANT: Identificar tenant
    // ============================================================
    let tenantId: string | null = tenantIdParam;
    
    // Se não veio no body, tentar extrair do usuário autenticado
    if (!tenantId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single();
          tenantId = profile?.tenant_id || null;
        }
      }
    }

    console.log("🏢 Tenant ID:", tenantId || 'não identificado');
    // ============================================================

    // Validação da instância
    if (!instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: "Nome da instância é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // Buscar credenciais Z-API da instância no banco
    // Sem fallback para hardcoded — cada tenant TEM que ter
    // sua instância configurada.
    // ============================================================
    let instanceId: string | null = null;
    let token: string | null = null;
    let clientToken: string | null = null;
    let instanciaDbId: string | null = null;

    const instanceQuery = supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("instance_name", instanceName)
      .eq("active", true);

    // Se temos tenant_id, filtrar por ele (segurança multi-tenant)
    if (tenantId) {
      instanceQuery.eq("tenant_id", tenantId);
    }

    const { data: instance, error: instErr } = await instanceQuery.maybeSingle();

    if (!instance) {
      // Tentar por display_name
      const displayQuery = supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("display_name", instanceName)
        .eq("active", true);
      
      if (tenantId) {
        displayQuery.eq("tenant_id", tenantId);
      }

      const { data: instanceByDisplay } = await displayQuery.maybeSingle();

      if (!instanceByDisplay) {
        console.error("❌ Instância não encontrada:", instanceName);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Instância WhatsApp '${instanceName}' não encontrada ou inativa` 
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      instanceId = instanceByDisplay.instance_id;
      token = instanceByDisplay.instance_token;
      clientToken = instanceByDisplay.client_token;
      instanciaDbId = instanceByDisplay.id;
      tenantId = tenantId || instanceByDisplay.tenant_id;
    } else {
      instanceId = instance.instance_id;
      token = instance.instance_token;
      clientToken = instance.client_token;
      instanciaDbId = instance.id;
      tenantId = tenantId || instance.tenant_id;
    }

    // Validar que temos credenciais
    if (!instanceId || !token || !clientToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Instância encontrada mas credenciais Z-API incompletas. Configure instance_id, instance_token e client_token." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Instância:", instanceName, "| Tenant:", tenantId);

    // Interface para destinatários processados
    interface Dest {
      telefone: string;
      nome: string;
      id?: string;
      variaveis: Record<string, string>;
    }
    
    let lista: Dest[] = [];
    
    if (destinatarios.length > 0) {
      console.log("📋 Usando formato NOVO (destinatarios com variáveis)");
      lista = destinatarios.map((d: any) => ({
        telefone: d.telefone,
        nome: d.nome || '',
        id: d.id,
        variaveis: {
          nome: d.nome || '',
          primeiro_nome: d.primeiro_nome || (d.nome || '').split(' ')[0],
          telefone: d.telefone || '',
          email: d.email || '',
          bairro: d.bairro || '',
          protocolo: d.protocolo || '',
          titulo: d.titulo || '',
          assunto: d.assunto || '',
          status: d.status || '',
          data: d.data || new Date().toLocaleDateString('pt-BR'),
          hora: d.hora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      }));
    } else if (telefones.length > 0) {
      console.log("📋 Usando formato ANTIGO (telefones simples)");
      lista = telefones.map((t: any) => {
        const tel = typeof t === 'object' ? t.telefone : t;
        const nome = typeof t === 'object' ? (t.nome || '') : '';
        return {
          telefone: tel,
          nome: nome,
          variaveis: {
            nome: nome,
            primeiro_nome: nome.split(' ')[0],
            telefone: tel,
            email: '',
            bairro: typeof t === 'object' ? (t.bairro || '') : '',
            protocolo: typeof t === 'object' ? (t.protocolo || '') : '',
            titulo: typeof t === 'object' ? (t.titulo || '') : '',
            assunto: '',
            status: typeof t === 'object' ? (t.status || '') : '',
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          }
        };
      });
    } else if (incluirTodos) {
      console.log("📋 Buscando TODOS os munícipes");
      // MULTI-TENANT: filtrar por tenant_id
      const municipeQuery = supabase
        .from("municipes")
        .select("id, nome, telefone, email, bairro")
        .not("telefone", "is", null);
      
      if (tenantId) {
        municipeQuery.eq("tenant_id", tenantId);
      }

      const { data: municipes } = await municipeQuery;
      
      if (municipes) {
        lista = municipes.map(m => ({
          telefone: m.telefone,
          nome: m.nome || '',
          id: m.id,
          variaveis: {
            nome: m.nome || '',
            primeiro_nome: (m.nome || '').split(' ')[0],
            telefone: m.telefone || '',
            email: m.email || '',
            bairro: m.bairro || '',
            protocolo: '',
            titulo: '',
            assunto: '',
            status: '',
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          }
        }));
      }
    }
    
    // Remover duplicatas
    const unicos = new Set<string>();
    lista = lista.filter(d => {
      if (!d.telefone || unicos.has(d.telefone)) return false;
      unicos.add(d.telefone);
      return true;
    });
    
    console.log(`📱 Total após dedup: ${lista.length}`);
    
    if (lista.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum telefone válido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (ordemAleatoria) {
      lista = embaralharArray(lista);
      console.log("🔀 Ordem aleatória aplicada");
    }

    let envioId: string | null = envioIdExterno;
    
    if (!envioId && salvarHistorico) {
      console.log("📝 Criando novo registro de envio...");
      const { data: envio, error: envioError } = await supabase.from('whatsapp_envios').insert({
        titulo: tituloEnvio || mensagem.substring(0, 100) || `Envio ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`,
        tipo,
        conteudo: { mensagem, ...conteudo },
        total_destinatarios: lista.length,
        ordem_aleatoria: ordemAleatoria,
        delay_min: tempoMinimo,
        delay_max: tempoMaximo,
        reacao_automatica: reacaoAutomatica,
        instancia_id: instanciaDbId,
        instancia_nome: instanceName,
        status: 'enviando',
        iniciado_em: new Date().toISOString(),
        tenant_id: tenantId  // MULTI-TENANT
      }).select().single();
      
      if (envio) {
        envioId = envio.id;
        console.log("✅ Envio criado:", envioId);
      } else if (envioError) {
        console.warn("⚠️ Erro ao criar envio:", envioError.message);
      }
    }

    const results: any[] = [];
    let ok = 0, erros = 0;

    for (let i = 0; i < lista.length; i++) {
      const dest = lista[i];
      const phone = normalizePhone(dest.telefone);
      
      console.log(`\n📱 [${i + 1}/${lista.length}] ${dest.nome || phone}`);
      
      if (i > 0 && (tempoMinimo > 0 || tempoMaximo > 0)) {
        const ms = Math.round((Math.random() * (tempoMaximo - tempoMinimo) + tempoMinimo) * 1000);
        console.log(`⏳ Aguardando ${ms}ms...`);
        await new Promise(r => setTimeout(r, ms));
      }
      
      const msgFinal = customMessages[dest.telefone] 
        ? substituirVariaveis(customMessages[dest.telefone], dest.variaveis)
        : substituirVariaveis(mensagem, dest.variaveis);
      
      let resp: any = null;
      
      try {
        switch (tipo) {
          case 'localizacao':
            if (localizacao) {
              resp = await callZApi(instanceId, token, clientToken, 'send-location', {
                phone, 
                latitude: String(localizacao.latitude), 
                longitude: String(localizacao.longitude),
                name: localizacao.nome || '', 
                address: localizacao.endereco || ''
              });
            }
            break;
            
          case 'contato':
            if (contato) {
              resp = await callZApi(instanceId, token, clientToken, 'send-contact', {
                phone, 
                contactName: contato.nome, 
                contactPhone: normalizePhone(contato.telefone),
                contactBusinessDescription: contato.descricao || ''
              });
            }
            break;
            
          case 'enquete':
            if (enquete) {
              resp = await callZApi(instanceId, token, clientToken, 'send-poll', {
                phone, 
                pollTitle: substituirVariaveis(enquete.pergunta, dest.variaveis),
                options: enquete.opcoes, 
                allowMultipleAnswers: enquete.multiplas || false
              });
            }
            break;
            
          case 'imagem':
            const imgUrl = conteudo?.url || mediaFiles[0]?.url;
            if (imgUrl) {
              const cap = conteudo?.legenda 
                ? substituirVariaveis(conteudo.legenda, dest.variaveis) 
                : msgFinal;
              resp = await callZApi(instanceId, token, clientToken, 'send-image', { 
                phone, image: imgUrl, caption: cap 
              });
            }
            break;
            
          case 'video':
            const vidUrl = conteudo?.url || mediaFiles[0]?.url;
            if (vidUrl) {
              const cap = conteudo?.legenda 
                ? substituirVariaveis(conteudo.legenda, dest.variaveis) 
                : msgFinal;
              resp = await callZApi(instanceId, token, clientToken, 'send-video', { 
                phone, video: vidUrl, caption: cap 
              });
            }
            break;
            
          case 'audio':
            const audUrl = conteudo?.url || mediaFiles[0]?.url;
            if (audUrl) {
              resp = await callZApi(instanceId, token, clientToken, 'send-audio', { 
                phone, audio: audUrl 
              });
            }
            break;
            
          case 'documento':
            const docUrl = conteudo?.url || mediaFiles[0]?.url;
            if (docUrl) {
              const fn = substituirVariaveis(
                conteudo?.nomeArquivo || mediaFiles[0]?.filename || 'documento.pdf', 
                dest.variaveis
              );
              const ext = fn.split('.').pop()?.toLowerCase() || 'pdf';
              resp = await callZApi(instanceId, token, clientToken, `send-document/${ext}`, { 
                phone, document: docUrl, fileName: fn 
              });
            }
            break;
            
          default:
            let sent = false;
            
            for (const media of mediaFiles) {
              const mt = detectMediaType(media);
              const mUrl = media.url || media.data;
              
              if (mt === 'image') {
                resp = await callZApi(instanceId, token, clientToken, 'send-image', { 
                  phone, image: mUrl, caption: sent ? '' : msgFinal 
                });
                sent = true;
              } else if (mt === 'video') {
                resp = await callZApi(instanceId, token, clientToken, 'send-video', { 
                  phone, video: mUrl, caption: sent ? '' : msgFinal 
                });
                sent = true;
              } else if (mt === 'audio') {
                resp = await callZApi(instanceId, token, clientToken, 'send-audio', { 
                  phone, audio: mUrl 
                });
              } else {
                const ext = (media.filename || 'documento.pdf').split('.').pop()?.toLowerCase() || 'pdf';
                resp = await callZApi(instanceId, token, clientToken, `send-document/${ext}`, { 
                  phone, document: mUrl, fileName: media.filename || 'documento' 
                });
              }
              
              if (!resp?.ok) break;
              await new Promise(r => setTimeout(r, 1000));
            }
            
            if (!sent && msgFinal) {
              resp = await callZApi(instanceId, token, clientToken, 'send-text', { 
                phone, 
                message: msgFinal, 
                delayTyping: calcularDelayTyping(msgFinal) 
              });
            }
        }
        
        if (resp?.ok) {
          console.log('✅ Enviado com sucesso');
          ok++;
          
          const zapiId = resp.body?.zapiId || resp.body?.messageId || resp.body?.id;
          results.push({ 
            telefone: dest.telefone, 
            nome: dest.nome, 
            status: 'sucesso', 
            zapiId 
          });
          
          if (envioId) {
            await supabase.from('whatsapp_envios_destinatarios').insert({
              envio_id: envioId, 
              telefone: dest.telefone, 
              telefone_formatado: phone,
              nome: dest.nome, 
              municipe_id: dest.id || null, 
              variaveis: dest.variaveis,
              status: 'enviado', 
              mensagem_enviada: msgFinal, 
              zapi_message_id: zapiId,
              enviado_em: new Date().toISOString(), 
              ordem: i,
              tenant_id: tenantId  // MULTI-TENANT
            });
          }
        } else {
          throw new Error(resp?.error || 'Erro desconhecido da Z-API');
        }
        
      } catch (e: any) {
        console.error('❌ Erro:', e.message);
        erros++;
        
        results.push({ 
          telefone: dest.telefone, 
          nome: dest.nome, 
          status: 'erro', 
          erro: e.message 
        });
        
        if (envioId) {
          await supabase.from('whatsapp_envios_destinatarios').insert({
            envio_id: envioId, 
            telefone: dest.telefone, 
            telefone_formatado: phone,
            nome: dest.nome, 
            municipe_id: dest.id || null, 
            status: 'erro',
            erro_mensagem: e.message, 
            ordem: i,
            tenant_id: tenantId  // MULTI-TENANT
          });
        }
      }
    }

    // Atualizar estatísticas do envio
    if (envioId && !envioIdExterno) {
      await supabase.from('whatsapp_envios').update({
        status: erros === lista.length ? 'erro' : 'concluido',
        total_enviados: ok, 
        total_erros: erros,
        concluido_em: new Date().toISOString()
      }).eq('id', envioId);
    }

    // ============================================================
    // MULTI-TENANT: Registrar uso de WhatsApp
    // ============================================================
    if (tenantId && ok > 0) {
      const mesAtual = new Date().toISOString().substring(0, 7) + '-01';
      await supabase.rpc('increment_whatsapp_usage', {
        p_tenant_id: tenantId,
        p_mes: mesAtual,
        p_envios: ok
      }).then(({ error }) => {
        if (error) console.warn('⚠️ Erro ao registrar uso WhatsApp:', error.message);
        else console.log(`📊 Uso registrado: ${ok} envios`);
      });
    }
    // ============================================================

    console.log(`\n📊 RESULTADO FINAL: ✅ ${ok} sucessos | ❌ ${erros} erros`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        envioId, 
        resumo: { total: lista.length, sucessos: ok, erros }, 
        resultados: results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("💥 ERRO CRÍTICO:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
