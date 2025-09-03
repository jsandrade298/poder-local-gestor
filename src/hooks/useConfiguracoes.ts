import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConfiguracaoData {
  gabinete: {
    nome: string;
    descricao: string;
    endereco: string;
    telefone: string;
    email: string;
  };
  tema: {
    cor_primaria: string;
    cor_secundaria: string;
    logo_url: string;
    favicon_url: string;
  };
  redes_sociais: {
    whatsapp: string;
    instagram: string;
    facebook: string;
    twitter: string;
    linkedin: string;
  };
  sistema: {
    timezone: string;
    idioma: string;
    formato_data: string;
    limite_upload_mb: number;
    backup_automatico: boolean;
  };
}

export const useConfiguracoes = () => {
  return useQuery({
    queryKey: ['configuracoes'],
    queryFn: async (): Promise<ConfiguracaoData> => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*');
      
      if (error) throw error;

      // Converter array de configurações em objeto estruturado
      const config: ConfiguracaoData = {
        gabinete: {
          nome: "",
          descricao: "",
          endereco: "",
          telefone: "",
          email: ""
        },
        tema: {
          cor_primaria: "#3b82f6",
          cor_secundaria: "#10b981",
          logo_url: "",
          favicon_url: ""
        },
        redes_sociais: {
          whatsapp: "",
          instagram: "",
          facebook: "",
          twitter: "",
          linkedin: ""
        },
        sistema: {
          timezone: "America/Sao_Paulo",
          idioma: "pt-BR",
          formato_data: "DD/MM/AAAA",
          limite_upload_mb: 10,
          backup_automatico: true
        }
      };

      // Preencher com dados do banco
      data.forEach((item) => {
        const [section, field] = item.chave.split('.');
        if (config[section as keyof ConfiguracaoData] && field) {
          const sectionData = config[section as keyof ConfiguracaoData] as any;
          if (field === 'limite_upload_mb') {
            sectionData[field] = parseInt(item.valor || '10');
          } else if (field === 'backup_automatico') {
            sectionData[field] = item.valor === 'true';
          } else {
            sectionData[field] = item.valor || "";
          }
        }
      });

      return config;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};