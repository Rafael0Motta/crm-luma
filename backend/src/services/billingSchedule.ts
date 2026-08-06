export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysUntilNextDueDate(dueDay: number, today: Date): number {
  const currentMonthDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
  const target = currentMonthDue >= startOfDay(today) ? currentMonthDue : new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
  const diffMs = target.getTime() - startOfDay(today).getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

export function offsetMatches(daysOffset: number, daysToDue: number): boolean {
  // offset negativo = X dias antes do vencimento; positivo = X dias depois
  return daysOffset <= 0 ? daysToDue === Math.abs(daysOffset) : -daysToDue === daysOffset;
}
