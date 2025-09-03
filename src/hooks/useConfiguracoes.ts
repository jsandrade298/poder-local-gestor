import { useState, useEffect } from 'react'
import { supabase, type Configuracao } from '@/lib/supabase'

export const useConfiguracoes = () => {
  const [configuracoes, setConfiguracoes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConfiguracoes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')

      if (error) throw error

      // Converter array para objeto chave-valor
      const configObj = data?.reduce((acc, config) => {
        acc[config.chave] = config.valor || ''
        return acc
      }, {} as Record<string, string>) || {}

      setConfiguracoes(configObj)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  const updateConfiguracao = async (chave: string, valor: string) => {
    try {
      const { error } = await supabase
        .from('configuracoes')
        .upsert([{ chave, valor }])

      if (error) throw error

      setConfiguracoes(prev => ({ ...prev, [chave]: valor }))
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar configuração'
      return { error: errorMessage }
    }
  }

  const updateMultipleConfiguracoes = async (updates: Record<string, string>) => {
    try {
      const upsertData = Object.entries(updates).map(([chave, valor]) => ({
        chave,
        valor
      }))

      const { error } = await supabase
        .from('configuracoes')
        .upsert(upsertData)

      if (error) throw error

      setConfiguracoes(prev => ({ ...prev, ...updates }))
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar configurações'
      return { error: errorMessage }
    }
  }

  const getConfiguracao = (chave: string, defaultValue: string = '') => {
    return configuracoes[chave] || defaultValue
  }

  // Helpers para configurações específicas
  const getGabineteConfig = () => ({
    nome: getConfiguracao('gabinete_nome', 'Gabinete'),
    email: getConfiguracao('gabinete_email', ''),
    descricao: getConfiguracao('gabinete_descricao', ''),
    endereco: getConfiguracao('gabinete_endereco', ''),
    telefone: getConfiguracao('gabinete_telefone', '')
  })

  const getTemaConfig = () => ({
    cor_primaria: getConfiguracao('cor_primaria', '#3b82f6'),
    cor_secundaria: getConfiguracao('cor_secundaria', '#10b981'),
    logo_url: getConfiguracao('logo_url', ''),
    favicon_url: getConfiguracao('favicon_url', '')
  })

  const getRedesSociaisConfig = () => ({
    whatsapp: getConfiguracao('whatsapp_url', ''),
    instagram: getConfiguracao('instagram_url', ''),
    facebook: getConfiguracao('facebook_url', ''),
    twitter: getConfiguracao('twitter_url', ''),
    linkedin: getConfiguracao('linkedin_url', '')
  })

  const getSistemaConfig = () => ({
    timezone: getConfiguracao('timezone', 'America/Sao_Paulo'),
    idioma: getConfiguracao('idioma', 'pt-BR'),
    formato_data: getConfiguracao('formato_data', 'DD/MM/AAAA'),
    limite_upload_mb: parseInt(getConfiguracao('limite_upload_mb', '10')),
    backup_automatico: getConfiguracao('backup_automatico', 'true') === 'true'
  })

  useEffect(() => {
    fetchConfiguracoes()
  }, [])

  return {
    configuracoes,
    loading,
    error,
    fetchConfiguracoes,
    updateConfiguracao,
    updateMultipleConfiguracoes,
    getConfiguracao,
    getGabineteConfig,
    getTemaConfig,
    getRedesSociaisConfig,
    getSistemaConfig
  }
}