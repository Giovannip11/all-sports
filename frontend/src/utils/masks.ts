/** Input masks applied as the user types — kept in one place so every screen
 * (login, cadastro, perfil, criar evento) formats the same way. */

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Brazilian phone, with or without the 9th digit: (11) 9999-9999 / (11) 99999-9999. */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.replace(/(\d{0,2})/, '($1');
  if (digits.length <= 6) return digits.replace(/(\d{2})(\d{0,4})/, '($1) $2');
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

/** DD/MM/AAAA, auto-inserting the slashes as digits come in. */
export function formatDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.replace(/(\d{2})(\d{0,2})/, '$1/$2');
  return digits.replace(/(\d{2})(\d{2})(\d{0,4})/, '$1/$2/$3');
}

/** HH:MM, auto-inserting the colon as digits come in. */
export function formatTime(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.replace(/(\d{2})(\d{0,2})/, '$1:$2');
}
