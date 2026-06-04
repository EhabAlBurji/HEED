import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Activity,
  MessageSquare,
  Gem,
  FolderKanban,
  Workflow,
  Settings as SettingsIcon,
  Users,
  BriefcaseBusiness,
} from "lucide-react";
import { HeedLogo } from "../HeedLogo";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { isAdmin } from "../../lib/admin";

// =========================================================================
// Slim icon-only rail — shown in place of the full Sidebar on the Chat page
// so HEED CHAT gets a full-width, ChatGPT-style canvas. Icon-only with
// tooltips; fades/slides in gently so the collapse isn't jarring.
// =========================================================================

const items = [
  { to: "/messages",  icon: MessageSquare,    key: "nav.messages",  end: true },
  { to: "/inbox",     icon: Activity,         key: "nav.activity",  end: true },
  { to: "/projects",  icon: FolderKanban,     key: "nav.projects",  end: false },
  { to: "/chat",      icon: Gem,              key: "nav.chat",      end: false },
  { to: "/boards",    icon: Workflow,         key: "nav.boards",    end: false },
  { to: "/dashboard", icon: LayoutDashboard,  key: "nav.dashboard", end: false },
  { to: "/hr",        icon: BriefcaseBusiness, key: "nav.hr",       end: false },
];

const itemCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    "grid h-10 w-10 place-items-center rounded-xl transition-colors",
    isActive
      ? "bg-primary text-white shadow-[0_4px_16px_hsl(var(--primary)/0.25)]"
      : "text-foreground/55 hover:bg-secondary hover:text-foreground"
  );

export function MiniRail() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const nav = isAdmin(user?.email)
    ? [...items, { to: "/admin", icon: Users, key: "nav.admin", end: false }]
    : items;

  return (
    <motion.aside
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: 56 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="flex h-full shrink-0 flex-col items-center overflow-hidden border-e border-border bg-card py-3"
    >
      <NavLink to="/" className="mb-3" title="Heed">
        <HeedLogo className="h-7 w-7 text-primary" />
      </NavLink>

      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {nav.map(({ to, icon: Icon, key, end }) => (
          <NavLink key={to} to={to} end={end} title={t(key)} className={itemCls}>
            <Icon className="h-[18px] w-[18px]" />
          </NavLink>
        ))}
      </nav>

      <NavLink to="/settings" title={t("nav.settings")} className={itemCls}>
        <SettingsIcon className="h-[18px] w-[18px]" />
      </NavLink>
    </motion.aside>
  );
}
