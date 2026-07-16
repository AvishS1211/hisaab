import { describe, it, expect } from "vitest";
import { parseLine } from "./parseLine";

describe("parseLine", () => {
  it("takes the trailing number as the amount and the rest as the label", () => {
    expect(parseLine("Petrol 2400")).toEqual({ label: "Petrol", amount: 2400 });
  });

  it("keeps multi-word labels", () => {
    expect(parseLine("Uber to airport 350")).toEqual({
      label: "Uber to airport",
      amount: 350,
    });
  });

  it("accepts a grouped amount like 2,400", () => {
    expect(parseLine("Hotel 2,400")).toEqual({ label: "Hotel", amount: 2400 });
  });

  it("is not committable until there is both a label and an amount", () => {
    expect(parseLine("Petrol").amount).toBeNull();
    expect(parseLine("2400").amount).toBeNull(); // number alone, no label
    expect(parseLine("").amount).toBeNull();
  });

  it("rejects a decimal amount (no paise)", () => {
    expect(parseLine("Chai 40.5").amount).toBeNull();
  });

  it("rejects zero and negative", () => {
    expect(parseLine("Free 0").amount).toBeNull();
    expect(parseLine("Owe -5").amount).toBeNull();
  });
});
