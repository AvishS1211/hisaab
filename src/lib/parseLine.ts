// Likhna parsing: "Petrol 2400" → { label: "Petrol", amount: 2400 }.
// The last whitespace-separated token, if it's a whole number, is the amount;
// everything before it is the label. Integer rupees only — no paise, so a
// decimal in the amount position is not a valid amount. (CLAUDE.md §2, §4.)

export interface ParsedLine {
  label: string;
  amount: number | null; // null = not yet a committable line
}

export function parseLine(input: string): ParsedLine {
  const trimmed = input.trim();
  if (trimmed === "") return { label: "", amount: null };

  const tokens = trimmed.split(/\s+/);
  const last = tokens[tokens.length - 1]!;
  const digits = last.replace(/,/g, ""); // allow "2,400"

  if (!/^\d+$/.test(digits)) return { label: trimmed, amount: null };

  const amount = parseInt(digits, 10);
  const label = tokens.slice(0, -1).join(" ").trim();
  if (label === "" || amount <= 0) return { label, amount: null };

  return { label, amount };
}
