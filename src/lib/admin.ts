// Client-side admin gate (shows the Admin dashboard nav/page). The Edge
// Functions independently enforce ADMIN_EMAILS server-side, so this is only
// for hiding the UI from non-admins. Keep in sync with the ADMIN_EMAILS secret.
export const ADMIN_EMAILS = ["ehab@om.sa"];

export const isAdmin = (email?: string | null): boolean =>
  Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
