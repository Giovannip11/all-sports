const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPassword(value: string): boolean {
  return value.length >= 6;
}

export function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 10;
}
