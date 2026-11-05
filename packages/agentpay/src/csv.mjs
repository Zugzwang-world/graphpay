// CSV with RFC 4180 quoting, and no spreadsheet formulas: a cell that starts with = + - @ or a
// tab is prefixed with an apostrophe, so an exported reason can never run in a spreadsheet.

const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value === undefined || value === null) return '';
  let text = typeof value === 'bigint' ? value.toString() : String(value);
  if (FORMULA.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows) {
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}
