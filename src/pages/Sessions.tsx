import { useTranslation } from "react-i18next";

export default function Sessions() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="font-display text-3xl font-medium">{t("nav.sessions")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every session organised. Every minute accounted for.
      </p>
      <div className="mt-6 grid h-72 place-items-center rounded-2xl border border-dashed border-border/60 text-sm text-muted-foreground">
        Sessions list arrives in Phase 5
      </div>
    </div>
  );
}
