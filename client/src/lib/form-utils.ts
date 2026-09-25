export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function maskCpf(value: string) {
  const d = digitsOnly(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function maskCnpj(value: string) {
  const d = digitsOnly(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\/\d{4})(\d)/, "$1-$2");
}

export function maskCep(value: string) {
  const d = digitsOnly(value).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function maskPhone(value: string) {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskCurrency(value: string) {
  const d = digitsOnly(value);
  if (!d) return "";
  const number = Number(d) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
}

export function maskPercent(value: string, max = 100) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.min(max, Math.max(0, parsed))).replace(".", ",");
}

export function isValidCpf(value: string) {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (factor: number) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i++) total += Number(cpf[i]) * (factor - i);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(10) === Number(cpf[9]) && calc(11) === Number(cpf[10]);
}

export function isValidCnpj(value: string) {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const validateDigit = (baseLength: number) => {
    const weights = baseLength === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const total = weights.reduce((sum, weight, index) => sum + Number(cnpj[index]) * weight, 0);
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return validateDigit(12) === Number(cnpj[12]) && validateDigit(13) === Number(cnpj[13]);
}

export type PasswordStrength = {
  score: number;
  label: "Muito fraca" | "Fraca" | "Razoável" | "Forte" | "Muito forte";
  criteria: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
};

export function evaluatePassword(password: string): PasswordStrength {
  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/.test(password),
    lowercase: /[a-záàâãéèêíïóôõöúçñ]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-zÀ-ÿ\d]/.test(password),
  };
  const score = Object.values(criteria).filter(Boolean).length;
  const labels: PasswordStrength["label"][] = ["Muito fraca", "Muito fraca", "Fraca", "Razoável", "Forte", "Muito forte"];
  return { score, label: labels[score], criteria };
}
