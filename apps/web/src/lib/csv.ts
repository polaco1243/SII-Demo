function csvEscape(valor: unknown): string {
  const texto = String(valor ?? "");
  if (/[";\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/**
 * Delimitador ";" (no ",") porque las razones sociales reales suelen llevar
 * comas, y un BOM UTF-8 al inicio para que Excel reconozca tildes/ñ — sin él,
 * Excel asume Latin-1 y rompe cualquier carácter especial.
 */
export function generarCsv(encabezado: string[], filas: (string | number)[][]): string {
  const BOM = "﻿";
  const lineas = [encabezado, ...filas].map((fila) => fila.map(csvEscape).join(";"));
  return BOM + lineas.join("\n");
}

export function nombreArchivoConFecha(prefijo: string): string {
  const ahora = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fecha = `${ahora.getFullYear()}${pad(ahora.getMonth() + 1)}${pad(ahora.getDate())}`;
  const hora = `${pad(ahora.getHours())}${pad(ahora.getMinutes())}`;
  return `${prefijo}_${fecha}_${hora}.csv`;
}
