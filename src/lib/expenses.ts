import type { Expense, ExpenseCategory } from "@prisma/client";

export function expenseCategoryLabel(category: ExpenseCategory): string {
  switch (category) {
    case "TAX":
      return "Kfz-Steuer";
    case "INSURANCE":
      return "Versicherung";
    case "FEE":
      return "Gebühren";
    case "OTHER":
      return "Sonstiges";
  }
}

export type ExpenseSummary = {
  count: number;
  total: number;
  tax: number;
  insurance: number;
  other: number; // FEE + OTHER
};

export function summariseExpenses(expenses: Expense[]): ExpenseSummary {
  const s: ExpenseSummary = { count: expenses.length, total: 0, tax: 0, insurance: 0, other: 0 };
  for (const e of expenses) {
    s.total += e.amount;
    if (e.category === "TAX") s.tax += e.amount;
    else if (e.category === "INSURANCE") s.insurance += e.amount;
    else s.other += e.amount;
  }
  return s;
}
