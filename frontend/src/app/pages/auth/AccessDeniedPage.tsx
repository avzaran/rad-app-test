import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";

export function AccessDeniedPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">{t("accessDenied.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("accessDenied.description")}</p>
        <Button asChild className="mt-6">
          <Link to="/">Вернуться на дашборд</Link>
        </Button>
      </div>
    </div>
  );
}
