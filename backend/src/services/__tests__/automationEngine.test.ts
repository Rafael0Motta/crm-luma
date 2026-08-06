import { describe, expect, it } from "vitest";
import { evaluateConditions, AutomationEvent, Condition } from "../automationEngine";

const baseClient = { name: "Joao Silva", phone: "5511999999999", funnelStageId: "stage-1" };
const baseEvent: AutomationEvent = { trigger: "message_received", clientId: "client-1", messageContent: "Quero saber o preco do seguro" };

describe("evaluateConditions", () => {
  it("returns true when there are no conditions", () => {
    expect(evaluateConditions([], baseEvent, baseClient)).toBe(true);
  });

  it("matches a 'contains' condition on message content (case-insensitive)", () => {
    const conditions: Condition[] = [{ field: "message.content", operator: "contains", value: "PRECO" }];
    expect(evaluateConditions(conditions, baseEvent, baseClient)).toBe(true);
  });

  it("fails a 'contains' condition when the text is absent", () => {
    const conditions: Condition[] = [{ field: "message.content", operator: "contains", value: "cancelamento" }];
    expect(evaluateConditions(conditions, baseEvent, baseClient)).toBe(false);
  });

  it("matches 'equals' on client.funnelStageId", () => {
    const conditions: Condition[] = [{ field: "client.funnelStageId", operator: "equals", value: "stage-1" }];
    expect(evaluateConditions(conditions, baseEvent, baseClient)).toBe(true);
  });

  it("matches 'not_equals' when values differ", () => {
    const conditions: Condition[] = [{ field: "client.funnelStageId", operator: "not_equals", value: "stage-2" }];
    expect(evaluateConditions(conditions, baseEvent, baseClient)).toBe(true);
  });

  it("requires ALL conditions to match (AND semantics)", () => {
    const conditions: Condition[] = [
      { field: "message.content", operator: "contains", value: "preco" },
      { field: "client.name", operator: "equals", value: "outra pessoa" },
    ];
    expect(evaluateConditions(conditions, baseEvent, baseClient)).toBe(false);
  });

  it("reads the tag id from the event for tag.id conditions", () => {
    const event: AutomationEvent = { trigger: "tag_applied", clientId: "client-1", tagId: "tag-42" };
    const conditions: Condition[] = [{ field: "tag.id", operator: "equals", value: "tag-42" }];
    expect(evaluateConditions(conditions, event, baseClient)).toBe(true);
  });
});
