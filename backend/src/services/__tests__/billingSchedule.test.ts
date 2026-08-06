import { describe, expect, it } from "vitest";
import { daysUntilNextDueDate, offsetMatches } from "../billingSchedule";

describe("daysUntilNextDueDate", () => {
  it("returns 0 when due day is today", () => {
    const today = new Date(2026, 2, 15); // 15 mar 2026
    expect(daysUntilNextDueDate(15, today)).toBe(0);
  });

  it("returns days remaining within the same month", () => {
    const today = new Date(2026, 2, 10); // 10 mar 2026
    expect(daysUntilNextDueDate(15, today)).toBe(5);
  });

  it("rolls over to next month when the due day already passed", () => {
    const today = new Date(2026, 2, 20); // 20 mar 2026, dueDay 5 ja passou
    // proximo dia 5 sera 5 abr 2026 -> 16 dias a partir de 20 mar
    expect(daysUntilNextDueDate(5, today)).toBe(16);
  });
});

describe("offsetMatches", () => {
  it("matches a 'before due date' reminder (negative offset)", () => {
    expect(offsetMatches(-3, 3)).toBe(true);
    expect(offsetMatches(-3, 2)).toBe(false);
  });

  it("matches an 'after due date' reminder (positive offset)", () => {
    // apos o vencimento, daysUntilNextDueDate ja aponta para o proximo ciclo;
    // -daysToDue simula "dias desde o vencimento" quando negativo
    expect(offsetMatches(2, -2)).toBe(true);
    expect(offsetMatches(2, -1)).toBe(false);
  });

  it("matches exactly on the due date for offset 0", () => {
    expect(offsetMatches(0, 0)).toBe(true);
    expect(offsetMatches(0, 1)).toBe(false);
  });
});
