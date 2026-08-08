interface TemplateContext {
  clientName: string;
  serviceName?: string;
  value?: string;
  dueDay?: number;
}

export function renderBillingTemplate(template: string, ctx: TemplateContext): string {
  return template
    .replaceAll("{{nome}}", ctx.clientName)
    .replaceAll("{{servico}}", ctx.serviceName ?? "")
    .replaceAll("{{valor}}", ctx.value ?? "")
    .replaceAll("{{dia_vencimento}}", ctx.dueDay ? String(ctx.dueDay) : "");
}
