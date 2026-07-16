import { describe, it, expect } from "vitest";
import { buildPersonPage } from "./personView";
import { entries, people, hisaabs, members } from "./seed";

const view = buildPersonPage(entries, people, hisaabs, members, "p_you");

const find = (list: typeof view.active, id: string) =>
  list.find((s) => s.person.id === id)!;

describe("buildPersonPage — the working always reconciles to the total", () => {
  it("every person's breakdown lines sum to their net", () => {
    for (const s of [...view.active, ...view.old]) {
      const sum = s.lines.reduce((t, l) => t + l.youOwe, 0);
      expect(sum).toBe(s.youOwe);
    }
  });

  it("only shows non-zero balances", () => {
    for (const s of [...view.active, ...view.old]) {
      expect(s.youOwe).not.toBe(0);
    }
  });
});

describe("buildPersonPage — the seed's expected numbers", () => {
  it("nets Ravi across Goa, Ghar and his settlement", () => {
    const ravi = find(view.active, "p_ravi");
    // Goa: Ravi owes you 900. Ghar (Rent): Ravi owes you 10,000.
    // Ravi paid you 5,000 → Ravi owes you 5,900 net.
    expect(ravi.youOwe).toBe(-5900); // negative = they owe you
    const goa = ravi.lines.find((l) => l.hisaabId === "goa")!;
    const ghar = ravi.lines.find((l) => l.hisaabId === "ghar")!;
    const settle = ravi.lines.find((l) => l.kind === "settlement")!;
    expect(goa.youOwe).toBe(-900);
    expect(ghar.youOwe).toBe(-10000);
    expect(settle.youOwe).toBe(5000); // Ravi paid you → reduces what he owes
  });

  it("nets Dev across Goa and Ghar (no settlement)", () => {
    const dev = find(view.active, "p_dev");
    // Goa: Dev owes you 1,225. Ghar (Rent): 10,000. Total 11,225 owed to you.
    expect(dev.youOwe).toBe(-11225);
  });

  it("shows Rohan from Goa only", () => {
    const rohan = find(view.active, "p_rohan");
    expect(rohan.youOwe).toBe(-300); // Rohan owes you 300
    expect(rohan.lines).toHaveLength(1);
    expect(rohan.lines[0]!.hisaabId).toBe("goa");
  });

  it("puts moved-out Sameer in Old accounts, still owing", () => {
    expect(view.active.some((s) => s.person.id === "p_sameer")).toBe(false);
    const sameer = find(view.old, "p_sameer");
    expect(sameer.youOwe).toBe(-1000); // Sameer owes you 1,000 (his half of Deposit)
  });
});
