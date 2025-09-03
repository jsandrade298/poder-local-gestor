/**
 * Formata datas do tipo DATE (sem timezone) do PostgreSQL
 * Para evitar problemas de timezone, tratamos como data local
 */
export function formatDateOnly(dateString: string | Date): string {
  if (!dateString) return '';
  
  // Para campos DATE do PostgreSQL, precisamos tratar como data local
  // para evitar problemas de timezone
  const date = typeof dateString === 'string' 
    ? new Date(dateString + 'T12:00:00') // Adiciona meio-dia para evitar problemas de timezone
    : dateString;
  
  return date.toLocaleDateString('pt-BR');
}

/**
 * Formata timestamps com timezone
 */
export function formatDateTime(dateString: string | Date): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR');
}