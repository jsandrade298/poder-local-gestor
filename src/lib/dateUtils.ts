/**
 * Formata datas do tipo DATE (sem timezone) do PostgreSQL
 * Para evitar problemas de timezone, tratamos como data local
 */
export function formatDateOnly(dateString: string | Date): string {
  if (!dateString) return '';
  
  try {
    let date: Date;
    
    if (typeof dateString === 'string') {
      // Se a string contém 'T' (timestamp), usar diretamente
      // Se não contém 'T' (date only), adicionar meio-dia
      if (dateString.includes('T')) {
        date = new Date(dateString);
      } else {
        date = new Date(dateString + 'T12:00:00');
      }
    } else {
      date = dateString;
    }
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      console.error('Data inválida:', dateString);
      return 'Data inválida';
    }
    
    // Forçar formato brasileiro DD/MM/AAAA
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Erro ao formatar data:', error, 'Valor:', dateString);
    return 'Data inválida';
  }
}

/**
 * Formata timestamps com timezone
 */
export function formatDateTime(dateString: string | Date): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      console.error('Data/hora inválida:', dateString);
      return 'Data inválida';
    }
    
    return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR');
  } catch (error) {
    console.error('Erro ao formatar data/hora:', error, 'Valor:', dateString);
    return 'Data inválida';
  }
}