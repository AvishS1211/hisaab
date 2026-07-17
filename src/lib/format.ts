// Shared display formatting. Integer rupees only, never a decimal (CLAUDE.md §2).

export const inr = (n: number): string => n.toLocaleString("en-IN");

/** The masthead phrase for a signed net: "you owe ₹X" / "you're owed ₹X" / settled. */
export function netPhrase(net: number): string {
  if (net === 0) return "you're all settled up";
  return net > 0 ? `you owe ${inr(net)}` : `you're owed ${inr(-net)}`;
}
