function calcularDV(cuerpo: string): string {
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

export function validarRut(rutCompleto: string): boolean {
  const limpio = rutCompleto.replace(/[.\-\s]/g, "").toUpperCase();
  if (limpio.length < 2) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;

  return calcularDV(cuerpo) === dv;
}

/** Separa un RUT en cuerpo y dígito verificador (ej. "12.345.678-9" → {rut: "12345678", dv: "9"}). */
export function splitRut(rutCompleto: string): { rut: string; dv: string } {
  const limpio = rutCompleto.replace(/[.\-\s]/g, "").toUpperCase();
  return { rut: limpio.slice(0, -1), dv: limpio.slice(-1) };
}
