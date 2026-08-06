interface TemplateContext {
  clientName: string;
  policyNumber?: string;
  insurer?: string;
  insuranceType?: string;
  value?: string;
  dueDay?: number;
}

export function renderBillingTemplate(template: string, ctx: TemplateContext): string {
  return template
    .replaceAll("{{nome}}", ctx.clientName)
    .replaceAll("{{apolice}}", ctx.policyNumber ?? "")
    .replaceAll("{{seguradora}}", ctx.insurer ?? "")
    .replaceAll("{{tipo_seguro}}", ctx.insuranceType ?? "")
    .replaceAll("{{valor}}", ctx.value ?? "")
    .replaceAll("{{dia_vencimento}}", ctx.dueDay ? String(ctx.dueDay) : "");
}
