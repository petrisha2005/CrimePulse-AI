import type { CsvPreview } from "../types/crime";

const REQUIRED_COLUMNS = ["District_Name", "UnitName", "FIR_YEAR", "FIR_MONTH", "FIR_Day", "CrimeGroup_Name"];

const parseLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
};

export const buildCsvPreview = async (file: File): Promise<CsvPreview> => {
  const text = await file.slice(0, 256 * 1024).text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = lines[0] ? parseLine(lines[0]) : [];
  const rows = lines.slice(1, 11).map((line) => {
    const cells = parseLine(line);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = cells[index] || "";
      return acc;
    }, {});
  });

  return {
    headers,
    rows,
    missingRequired: REQUIRED_COLUMNS.filter((column) => !headers.includes(column))
  };
};
