/** Signed axis reading with two decimals: "+0.42", "−0.42" (true minus sign), never "−0.00". */
export function formatAxis(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const text = Math.abs(safe).toFixed(2);
  return (safe < 0 && text !== '0.00' ? '\u2212' : '+') + text;
}
