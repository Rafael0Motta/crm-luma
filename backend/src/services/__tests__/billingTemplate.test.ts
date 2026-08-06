import { describe, expect, it } from "vitest";
import { renderBillingTemplate } from "../billingTemplate";

describe("renderBillingTemplate", () => {
  it("substitutes all known placeholders", () => {
    const result = renderBillingTemplate(
      "Ola {{nome}}, sua apolice {{apolice}} da {{seguradora}} ({{tipo_seguro}}) vence dia {{dia_vencimento}}, valor R$ {{valor}}.",
      {
        clientName: "Maria",
        policyNumber: "AP-001",
        insurer: "Porto Seguro",
        insuranceType: "Auto",
        value: "250.00",
        dueDay: 10,
      }
    );

    expect(result).toBe("Ola Maria, sua apolice AP-001 da Porto Seguro (Auto) vence dia 10, valor R$ 250.00.");
  });

  it("replaces missing optional fields with an empty string", () => {
    const result = renderBillingTemplate("Ola {{nome}}, apolice: {{apolice}}", { clientName: "Joao" });
    expect(result).toBe("Ola Joao, apolice: ");
  });

  it("replaces every occurrence of a repeated placeholder", () => {
    const result = renderBillingTemplate("{{nome}} - {{nome}}", { clientName: "Ana" });
    expect(result).toBe("Ana - Ana");
  });
});
