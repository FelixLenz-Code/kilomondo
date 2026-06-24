import { Receipt, ShieldCheck, Landmark, Wallet } from "lucide-react";
import { requireUser, vehicleAccessWhere, getVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { summariseExpenses, expenseCategoryLabel } from "@/lib/expenses";
import {
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from "@/actions/expenses";
import { ExpenseForm } from "@/components/forms/expense-form";
import { DeleteButton } from "@/components/delete-button";
import { EditableRow } from "@/components/editable-row";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function CostsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getVehicleAccess(id, user.id);
  const canEdit = access != null && access.level !== "VIEWER";

  const vehicle = await db.vehicle.findFirst({
    where: { id, ...vehicleAccessWhere(user.id) },
    include: { expenses: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] } },
  });
  if (!vehicle) return null;

  const summary = summariseExpenses(vehicle.expenses);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Fixkosten gesamt" value={formatCurrency(summary.total)} sub={`${summary.count} Einträge`} icon={Wallet} />
        <StatCard label="Kfz-Steuer" value={formatCurrency(summary.tax)} icon={Landmark} />
        <StatCard label="Versicherung" value={formatCurrency(summary.insurance)} icon={ShieldCheck} />
        <StatCard label="Sonstiges" value={formatCurrency(summary.other)} icon={Receipt} />
      </div>

      <div className={canEdit ? "grid gap-6 lg:grid-cols-[380px_1fr]" : "space-y-6"}>
        {canEdit && (
          <Card className="glass h-fit">
            <CardHeader>
              <CardTitle>Neue Kosten</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseForm action={createExpenseAction.bind(null, id)} />
            </CardContent>
          </Card>
        )}

        <Card className="glass">
          <CardHeader>
            <CardTitle>Steuer, Versicherung &amp; Co. ({summary.count})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vehicle.expenses.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Noch keine Fixkosten erfasst. Hier kannst du Kfz-Steuer, Versicherung
                und Gebühren eintragen — sie fließen in die Kostenauswertung ein.
              </p>
            )}
            {vehicle.expenses.map((e) => (
              <EditableRow
                key={e.id}
                align="center"
                meta={<span className="font-medium">{formatCurrency(e.amount)}</span>}
                edit={
                  canEdit ? (
                    <ExpenseForm
                      action={updateExpenseAction.bind(null, id, e.id)}
                      defaults={{
                        date: e.date.toISOString().slice(0, 10),
                        category: e.category,
                        title: e.title,
                        amount: e.amount,
                        notes: e.notes,
                      }}
                    />
                  ) : undefined
                }
                deleteButton={
                  canEdit ? (
                    <DeleteButton action={deleteExpenseAction.bind(null, id, e.id)} />
                  ) : undefined
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{formatDate(e.date)}</span>
                  <Badge variant="secondary">{expenseCategoryLabel(e.category)}</Badge>
                  {e.title && <span className="text-sm text-muted-foreground">{e.title}</span>}
                </div>
                {e.notes && <p className="text-sm text-muted-foreground">{e.notes}</p>}
              </EditableRow>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
