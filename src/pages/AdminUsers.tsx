import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { isAdmin } from "../lib/admin";
import { listUsers, approveUser, type AdminUser } from "../lib/teamSync";
import { Page } from "../components/ui/grid";
import { cn } from "../lib/utils";

export default function AdminUsers() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const allowed = isAdmin(user?.email);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setUsers(await listUsers());
    setLoading(false);
  };

  useEffect(() => {
    if (allowed) void refresh();
    else setLoading(false);
  }, [allowed]);

  const approve = async (u: AdminUser) => {
    setBusy(u.id);
    const ok = await approveUser(u.id);
    if (ok) setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, access_status: "approved" } : x)));
    setBusy(null);
  };

  if (!allowed) {
    return (
      <Page className="h-full">
        <div className="grid h-64 place-items-center text-sm text-muted-foreground">{t("admin.forbidden")}</div>
      </Page>
    );
  }

  return (
    <Page className="h-full overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-semibold">{t("admin.title")}</h1>
            <p className="font-micro text-xs text-muted-foreground">{t("admin.desc")}</p>
          </div>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          {t("admin.refresh")}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60">
        {users.length === 0 && !loading && (
          <p className="px-4 py-10 text-center font-micro text-sm text-muted-foreground/50">{t("admin.empty")}</p>
        )}
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 border-b border-border/40 px-4 py-3 last:border-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 text-sm font-bold text-primary">
              {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : (u.name?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.name || u.email}</p>
              <p className="truncate font-micro text-xs text-muted-foreground">{u.email}</p>
            </div>
            <span className="shrink-0 font-micro text-[10px] text-muted-foreground/60">
              {t("admin.joined")} {new Date(u.created_at).toLocaleDateString()}
            </span>
            {u.access_status === "approved" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 font-micro text-[11px] text-emerald-500">
                <ShieldCheck className="h-3.5 w-3.5" /> {t("admin.approved")}
              </span>
            ) : (
              <button
                onClick={() => approve(u)}
                disabled={busy === u.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                {busy === u.id ? t("admin.approving") : t("admin.approve")}
              </button>
            )}
          </div>
        ))}
      </div>
    </Page>
  );
}
