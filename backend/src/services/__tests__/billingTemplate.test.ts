import { describe, expect, it } from "vitest";
import { renderBillingTemplate } from "../billingTemplate";

describe("renderBillingTemplate", () => {
  it("substitutes all known placeholders", () => {
    const result = renderBillingTemplate("Ola {{nome}}, seu servico {{servico}} vence dia {{dia_vencimento}}, valor R$ {{valor}}.", {
      clientName: "Maria",
      serviceName: "Plano Saude Basico",
      value: "250.00",
      dueDay: 10,
    });

    expect(result).toBe("Ola Maria, seu servico Plano Saude Basico vence dia 10, valor R$ 250.00.");
  });

  it("replaces missing optional fields with an empty string", () => {
    const result = renderBillingTemplate("Ola {{nome}}, servico: {{servico}}", { clientName: "Joao" });
    expect(result).toBe("Ola Joao, servico: ");
  });

  it("replaces every occurrence of a repeated placeholder", () => {
    const result = renderBillingTemplate("{{nome}} - {{nome}}", { clientName: "Ana" });
    expect(result).toBe("Ana - Ana");
  });
});
