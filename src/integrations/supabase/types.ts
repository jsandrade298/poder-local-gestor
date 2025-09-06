export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agenda_acompanhantes: {
        Row: {
          agenda_id: string
          created_at: string
          id: string
          usuario_id: string
        }
        Insert: {
          agenda_id: string
          created_at?: string
          id?: string
          usuario_id: string
        }
        Update: {
          agenda_id?: string
          created_at?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_acompanhantes_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_mensagens: {
        Row: {
          agenda_id: string
          created_at: string
          id: string
          mensagem: string
          remetente_id: string
          updated_at: string
        }
        Insert: {
          agenda_id: string
          created_at?: string
          id?: string
          mensagem: string
          remetente_id: string
          updated_at?: string
        }
        Update: {
          agenda_id?: string
          created_at?: string
          id?: string
          mensagem?: string
          remetente_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_mensagens_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendas: {
        Row: {
          created_at: string
          data_hora_proposta: string
          data_pedido: string
          descricao_objetivo: string
          duracao_prevista: string
          id: string
          local_endereco: string
          material_apoio: string | null
          observacoes: string | null
          participantes: string
          pauta_sugerida: string
          solicitante_id: string
          status: Database["public"]["Enums"]["status_agenda"]
          titulo: string | null
          updated_at: string
          validador_id: string
        }
        Insert: {
          created_at?: string
          data_hora_proposta: string
          data_pedido?: string
          descricao_objetivo: string
          duracao_prevista: string
          id?: string
          local_endereco: string
          material_apoio?: string | null
          observacoes?: string | null
          participantes: string
          pauta_sugerida: string
          solicitante_id: string
          status?: Database["public"]["Enums"]["status_agenda"]
          titulo?: string | null
          updated_at?: string
          validador_id: string
        }
        Update: {
          created_at?: string
          data_hora_proposta?: string
          data_pedido?: string
          descricao_objetivo?: string
          duracao_prevista?: string
          id?: string
          local_endereco?: string
          material_apoio?: string | null
          observacoes?: string | null
          participantes?: string
          pauta_sugerida?: string
          solicitante_id?: string
          status?: Database["public"]["Enums"]["status_agenda"]
          titulo?: string | null
          updated_at?: string
          validador_id?: string
        }
        Relationships: []
      }
      anexos: {
        Row: {
          created_at: string | null
          demanda_id: string
          id: string
          nome_arquivo: string
          tamanho_arquivo: number | null
          tipo_arquivo: string | null
          uploaded_by: string
          url_arquivo: string
        }
        Insert: {
          created_at?: string | null
          demanda_id: string
          id?: string
          nome_arquivo: string
          tamanho_arquivo?: number | null
          tipo_arquivo?: string | null
          uploaded_by: string
          url_arquivo: string
        }
        Update: {
          created_at?: string | null
          demanda_id?: string
          id?: string
          nome_arquivo?: string
          tamanho_arquivo?: number | null
          tipo_arquivo?: string | null
          uploaded_by?: string
          url_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          responsavel_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          chave: string
          created_at: string | null
          descricao: string | null
          id: string
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          model_default: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model_default?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model_default?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demanda_atividades: {
        Row: {
          created_at: string
          created_by: string
          data_atividade: string
          demanda_id: string
          descricao: string | null
          id: string
          link_propositura: string | null
          propositura: string | null
          status_propositura: string | null
          tipo_atividade: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data_atividade?: string
          demanda_id: string
          descricao?: string | null
          id?: string
          link_propositura?: string | null
          propositura?: string | null
          status_propositura?: string | null
          tipo_atividade?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          data_atividade?: string
          demanda_id?: string
          descricao?: string | null
          id?: string
          link_propositura?: string | null
          propositura?: string | null
          status_propositura?: string | null
          tipo_atividade?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_atividades_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_demanda_atividades_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_notifications: {
        Row: {
          countdown: number | null
          created_at: string | null
          demanda_id: string
          demanda_titulo: string | null
          error_message: string | null
          id: string
          instance_name: string
          municipe_nome: string
          novo_status: string
          sent_at: string | null
          status: string | null
          telefone: string
          updated_at: string | null
        }
        Insert: {
          countdown?: number | null
          created_at?: string | null
          demanda_id: string
          demanda_titulo?: string | null
          error_message?: string | null
          id?: string
          instance_name: string
          municipe_nome: string
          novo_status: string
          sent_at?: string | null
          status?: string | null
          telefone: string
          updated_at?: string | null
        }
        Update: {
          countdown?: number | null
          created_at?: string | null
          demanda_id?: string
          demanda_titulo?: string | null
          error_message?: string | null
          id?: string
          instance_name?: string
          municipe_nome?: string
          novo_status?: string
          sent_at?: string | null
          status?: string | null
          telefone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      demanda_tags: {
        Row: {
          created_at: string | null
          demanda_id: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          demanda_id: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          demanda_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_tags_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas: {
        Row: {
          area_id: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          created_at: string | null
          criado_por: string
          data_prazo: string | null
          descricao: string
          id: string
          kanban_position: string | null
          logradouro: string | null
          municipe_id: string
          numero: string | null
          observacoes: string | null
          prioridade: Database["public"]["Enums"]["prioridade_demanda"] | null
          protocolo: string
          resolucao: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_demanda"] | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string | null
          criado_por: string
          data_prazo?: string | null
          descricao: string
          id?: string
          kanban_position?: string | null
          logradouro?: string | null
          municipe_id: string
          numero?: string | null
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_demanda"] | null
          protocolo: string
          resolucao?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_demanda"] | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          created_at?: string | null
          criado_por?: string
          data_prazo?: string | null
          descricao?: string
          id?: string
          kanban_position?: string | null
          logradouro?: string | null
          municipe_id?: string
          numero?: string | null
          observacoes?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_demanda"] | null
          protocolo?: string
          resolucao?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_demanda"] | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_municipe_id_fkey"
            columns: ["municipe_id"]
            isOneToOne: false
            referencedRelation: "municipes"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_modelo: {
        Row: {
          ativo: boolean
          categoria: string
          conteudo_extraido: string | null
          created_at: string
          id: string
          nome: string
          tamanho_arquivo: number | null
          tipo_arquivo: string
          updated_at: string
          uploaded_by: string
          url_arquivo: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          conteudo_extraido?: string | null
          created_at?: string
          id?: string
          nome: string
          tamanho_arquivo?: number | null
          tipo_arquivo: string
          updated_at?: string
          uploaded_by: string
          url_arquivo: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          conteudo_extraido?: string | null
          created_at?: string
          id?: string
          nome?: string
          tamanho_arquivo?: number | null
          tipo_arquivo?: string
          updated_at?: string
          uploaded_by?: string
          url_arquivo?: string
        }
        Relationships: []
      }
      eixos: {
        Row: {
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      logs_aniversario: {
        Row: {
          aniversariantes: Json | null
          created_at: string | null
          data_envio: string | null
          error_message: string | null
          id: string
          quantidade: number | null
          success: boolean | null
          teste: boolean | null
        }
        Insert: {
          aniversariantes?: Json | null
          created_at?: string | null
          data_envio?: string | null
          error_message?: string | null
          id?: string
          quantidade?: number | null
          success?: boolean | null
          teste?: boolean | null
        }
        Update: {
          aniversariantes?: Json | null
          created_at?: string | null
          data_envio?: string | null
          error_message?: string | null
          id?: string
          quantidade?: number | null
          success?: boolean | null
          teste?: boolean | null
        }
        Relationships: []
      }
      municipe_tags: {
        Row: {
          created_at: string
          id: string
          municipe_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          municipe_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          municipe_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipe_tags_municipe_id_fkey"
            columns: ["municipe_id"]
            isOneToOne: false
            referencedRelation: "municipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "municipe_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      municipes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          profissao: string | null
          rg: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          profissao?: string | null
          rg?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          profissao?: string | null
          rg?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          atividade_id: string | null
          created_at: string
          demanda_id: string | null
          destinatario_id: string
          id: string
          lida: boolean
          mensagem: string
          remetente_id: string
          tipo: string
          titulo: string
          updated_at: string
          url_destino: string | null
        }
        Insert: {
          atividade_id?: string | null
          created_at?: string
          demanda_id?: string | null
          destinatario_id: string
          id?: string
          lida?: boolean
          mensagem: string
          remetente_id: string
          tipo?: string
          titulo: string
          updated_at?: string
          url_destino?: string | null
        }
        Update: {
          atividade_id?: string | null
          created_at?: string
          demanda_id?: string | null
          destinatario_id?: string
          id?: string
          lida?: boolean
          mensagem?: string
          remetente_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          url_destino?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "demanda_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_acao: {
        Row: {
          acao: string
          apoio: string | null
          atualizacao: string | null
          concluida: boolean
          created_at: string
          created_by: string
          eixo_id: string | null
          id: string
          prazo: string | null
          prioridade_id: string | null
          responsavel_id: string | null
          status_id: string | null
          tema_id: string | null
          updated_at: string
        }
        Insert: {
          acao: string
          apoio?: string | null
          atualizacao?: string | null
          concluida?: boolean
          created_at?: string
          created_by: string
          eixo_id?: string | null
          id?: string
          prazo?: string | null
          prioridade_id?: string | null
          responsavel_id?: string | null
          status_id?: string | null
          tema_id?: string | null
          updated_at?: string
        }
        Update: {
          acao?: string
          apoio?: string | null
          atualizacao?: string | null
          concluida?: boolean
          created_at?: string
          created_by?: string
          eixo_id?: string | null
          id?: string
          prazo?: string | null
          prioridade_id?: string | null
          responsavel_id?: string | null
          status_id?: string | null
          tema_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_acao_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_acao_eixo_id_fkey"
            columns: ["eixo_id"]
            isOneToOne: false
            referencedRelation: "eixos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_acao_prioridade_id_fkey"
            columns: ["prioridade_id"]
            isOneToOne: false
            referencedRelation: "prioridades_acao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_acao_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_acao_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "status_acao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_acao_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "temas_acao"
            referencedColumns: ["id"]
          },
        ]
      }
      prioridades_acao: {
        Row: {
          cor: string | null
          created_at: string
          id: string
          nivel: number
          nome: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          id?: string
          nivel: number
          nome: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          id?: string
          nivel?: number
          nome?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          created_at: string | null
          email: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string | null
          email: string
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      status_acao: {
        Row: {
          cor: string | null
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          cor: string | null
          created_at: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      temas_acao: {
        Row: {
          created_at: string
          eixo_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          eixo_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          eixo_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "temas_acao_eixo_id_fkey"
            columns: ["eixo_id"]
            isOneToOne: false
            referencedRelation: "eixos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string | null
          service: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          service: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          service?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          active: boolean | null
          api_url: string | null
          created_at: string
          display_name: string
          id: string
          instance_id: string | null
          instance_name: string
          instance_token: string | null
          last_connected_at: string | null
          phone_number: string | null
          profile_name: string | null
          profile_picture_url: string | null
          qr_code: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          api_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          instance_id?: string | null
          instance_name: string
          instance_token?: string | null
          last_connected_at?: string | null
          phone_number?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          api_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          instance_id?: string | null
          instance_name?: string
          instance_token?: string | null
          last_connected_at?: string | null
          phone_number?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agendar_exclusao_agenda: {
        Args: { agenda_id_param: string; data_hora_exclusao: string }
        Returns: undefined
      }
      bytea_to_text: {
        Args: { data: string }
        Returns: string
      }
      cancelar_exclusao_agenda: {
        Args: { agenda_id_param: string }
        Returns: undefined
      }
      create_user_direct: {
        Args: {
          user_cargo?: string
          user_email: string
          user_name: string
          user_password: string
          user_phone?: string
        }
        Returns: Json
      }
      enviar_mensagens_aniversario: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_protocolo: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_delete: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_get: {
        Args: { data: Json; uri: string } | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_post: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { data: Json; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      text_to_bytea: {
        Args: { data: string }
        Returns: string
      }
      urlencode: {
        Args: { data: Json } | { string: string } | { string: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "atendente" | "usuario"
      prioridade_demanda: "baixa" | "media" | "alta" | "urgente"
      status_agenda: "pendente" | "confirmado" | "recusado" | "remarcar"
      status_demanda:
        | "aberta"
        | "em_andamento"
        | "aguardando"
        | "resolvida"
        | "cancelada"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gestor", "atendente", "usuario"],
      prioridade_demanda: ["baixa", "media", "alta", "urgente"],
      status_agenda: ["pendente", "confirmado", "recusado", "remarcar"],
      status_demanda: [
        "aberta",
        "em_andamento",
        "aguardando",
        "resolvida",
        "cancelada",
      ],
    },
  },
} as const
