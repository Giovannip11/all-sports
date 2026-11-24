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

/** Parses "DD/MM/AAAA" into an ISO date (YYYY-MM-DD), or null if invalid. */
export function parseBirthDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

const MIN_SIGNUP_AGE = 16;

export function isOldEnough(isoDate: string): boolean {
  const birth = new Date(isoDate);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - MIN_SIGNUP_AGE);
  return birth <= cutoff;
}

function cpfCheckDigit(digits: number[], weightStart: number): number {
  let total = 0;
  let weight = weightStart;
  for (const digit of digits) {
    total += digit * weight;
    weight -= 1;
  }
  const remainder = (total * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCPF(value: string): boolean {
  const digits = value.replace(/\D/g, '').split('').map(Number);
  if (digits.length !== 11) return false;
  if (new Set(digits).size === 1) return false;

  const firstCheck = cpfCheckDigit(digits.slice(0, 9), 10);
  const secondCheck = cpfCheckDigit([...digits.slice(0, 9), firstCheck], 11);
  return digits[9] === firstCheck && digits[10] === secondCheck;
}
