interface TemplateContext {
  clientName: string;
  serviceName?: string;
  value?: string;
  dueDay?: number;
}

function formatCurrencyValue(value?: string): string {
  if (!value) return "";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function renderBillingTemplate(template: string, ctx: TemplateContext): string {
  return template
    .replaceAll("{{nome}}", ctx.clientName)
    .replaceAll("{{servico}}", ctx.serviceName ?? "")
    // aliases mantidos por compatibilidade com templates criados antes da migracao de apolices para servicos
    .replaceAll("{{apolice}}", ctx.serviceName ?? "")
    .replaceAll("{{seguradora}}", ctx.serviceName ?? "")
    .replaceAll("{{tipo_seguro}}", ctx.serviceName ?? "")
    .replaceAll("{{valor}}", formatCurrencyValue(ctx.value))
    .replaceAll("{{dia_vencimento}}", ctx.dueDay ? String(ctx.dueDay) : "");
}
