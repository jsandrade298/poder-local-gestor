/**
 * Utilitários para manipulação de números de telefone.
 *
 * CONVENÇÕES:
 * - Armazenamos telefone no banco apenas com dígitos (ex: "11999991111" ou
 *   "5511999991111"). Isso mantém compatibilidade com Z-API / WhatsApp, que
 *   esperam strings numéricas puras.
 * - Para exibição ao usuário, aplicamos máscara brasileira:
 *     11 dígitos → (11) 99999-1111  (celular)
 *     10 dígitos → (11) 9999-1111   (fixo)
 *     13 dígitos começando com 55 → +55 (11) 99999-1111
 * - Para busca, normalizamos QUALQUER input (com ou sem máscara) em só-dígitos,
 *   de forma que "11911111111", "(11) 91111-1111" e "11 91111-1111" sejam
 *   todos equivalentes ao filtrar.
 */

/** Remove tudo que não é dígito. Útil para comparar e para enviar ao WhatsApp. */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Remove não-dígitos e remove o DDI 55 do início (se presente).
 * Útil quando queremos comparar telefones sem se importar se foram salvos
 * com ou sem código do país.
 */
export function normalizePhoneNoDDI(phone: string | null | undefined): string {
  const digits = normalizePhone(phone);
  return digits.replace(/^55/, '');
}

/**
 * Formata para exibição amigável (máscara brasileira).
 * Mantém intacto se não for um formato brasileiro reconhecido —
 * nesse caso retorna o valor limpo sem quebrar.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const digits = normalizePhone(phone);
  if (!digits) return '';

  // Com DDI 55 (13 dígitos celular ou 12 fixo)
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const p1 = digits.slice(4, 9);
    const p2 = digits.slice(9, 13);
    return `+55 (${ddd}) ${p1}-${p2}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const p1 = digits.slice(4, 8);
    const p2 = digits.slice(8, 12);
    return `+55 (${ddd}) ${p1}-${p2}`;
  }

  // Celular sem DDI (11 dígitos)
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }

  // Fixo sem DDI (10 dígitos)
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  // Fallback — número curto ou estrangeiro — retorna limpo
  return digits;
}

/**
 * Formata enquanto o usuário digita, aplicando máscara progressiva.
 * Use em onChange de campos <Input>:
 *   onChange={(e) => setTelefone(maskPhoneInput(e.target.value))}
 */
export function maskPhoneInput(value: string): string {
  const digits = normalizePhone(value).slice(0, 11); // máximo 11 dígitos (celular sem DDI)

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    // Formato fixo: (XX) XXXX-XXXX enquanto tiver até 10 dígitos
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // 11 dígitos — celular
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}
