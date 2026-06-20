import { requireUser } from "@/lib/auth/guards";
import { ChangePasswordForm } from "@/components/forms/account-forms";
import { PushToggle } from "@/components/push-toggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Mein Konto</h1>
        <p className="mt-1 flex items-center gap-2 text-muted-foreground">
          {user.email}
          <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
            {user.role === "ADMIN" ? "Administrator" : "Benutzer"}
          </Badge>
        </p>
      </div>
      <Card className="glass">
        <CardHeader>
          <CardTitle>Passwort ändern</CardTitle>
          <CardDescription>
            Wähle ein starkes Passwort mit mindestens 8 Zeichen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Benachrichtigungen</CardTitle>
          <CardDescription>
            Erhalte Push-Benachrichtigungen – auch wenn die App geschlossen ist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushToggle />
        </CardContent>
      </Card>
    </div>
  );
}
