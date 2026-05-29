import { useGoogleCalendarStore } from "../stores/googleCalendarStore";
import { useMeetingsStore } from "../stores/meetingsStore";

const REDIRECT_URI = "http://localhost:8899/callback";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// ── OAuth URL ─────────────────────────────────────────────────────────────────

export function buildOAuthUrl(clientId: string): string {
  return (
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
    }).toString()
  );
}

// ── Start OAuth flow ──────────────────────────────────────────────────────────

export async function startOAuthFlow(clientId: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await invoke("start_oauth_listener");
  await openUrl(buildOAuthUrl(clientId));
}

// ── Exchange code for tokens ──────────────────────────────────────────────────

export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`فشل تبادل الرمز: ${text}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  useGoogleCalendarStore
    .getState()
    .setTokens(data.access_token, data.refresh_token ?? null, data.expires_in ?? 3600);
}

// ── Refresh access token ──────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<string | null> {
  const { clientId, clientSecret, refreshToken } =
    useGoogleCalendarStore.getState();
  if (!refreshToken) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!res.ok) return null;

  const data = await res.json() as { access_token: string; expires_in?: number };
  useGoogleCalendarStore
    .getState()
    .setTokens(data.access_token, null, data.expires_in ?? 3600);
  return data.access_token;
}

async function getValidToken(): Promise<string> {
  const { accessToken, tokenExpiry } = useGoogleCalendarStore.getState();
  // Refresh if token expires within 5 minutes
  if (!accessToken || !tokenExpiry || Date.now() > tokenExpiry - 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw new Error("الجلسة انتهت — يرجى إعادة الربط");
    return refreshed;
  }
  return accessToken;
}

// ── Map Google event → Meeting ────────────────────────────────────────────────

type GEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  attendees?: { email: string; displayName?: string; self?: boolean }[];
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { uri?: string; entryPointType?: string }[];
  };
};

function mapEvent(event: GEvent) {
  const title = event.summary?.trim();
  if (!title) return null;

  const startDate = event.start.date ?? event.start.dateTime?.slice(0, 10);
  if (!startDate) return null;

  let time: string | null = null;
  let duration_minutes: number | null = null;

  if (event.start.dateTime && event.end.dateTime) {
    const s = new Date(event.start.dateTime);
    const e = new Date(event.end.dateTime);
    time = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`;
    duration_minutes = Math.round((e.getTime() - s.getTime()) / 60000);
  }

  const attendees = (event.attendees ?? [])
    .filter((a) => !a.self)
    .map((a) => a.displayName ?? a.email.split("@")[0])
    .filter(Boolean);

  const meetingLink =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri ??
    null;

  return {
    title,
    date: startDate,
    time,
    duration_minutes,
    location: event.location ?? "",
    notes: (event.description ?? "").replace(/<[^>]*>/g, "").trim(),
    source: "google" as const,
    externalId: event.id,
    workspace_id: "personal",
    attendees,
    meetingLink,
  };
}

// ── Main sync ─────────────────────────────────────────────────────────────────

export async function syncGoogleCalendar(): Promise<number> {
  const token = await getValidToken();

  // Fetch events for -7 days → +90 days
  const timeMin = new Date(Date.now() - 7 * 86400000).toISOString();
  const timeMax = new Date(Date.now() + 90 * 86400000).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });

  const res = await fetch(`${CALENDAR_EVENTS_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    // Token rejected — clear connection
    useGoogleCalendarStore.getState().clearConnection();
    throw new Error("انتهت صلاحية الجلسة — يرجى إعادة الربط");
  }
  if (!res.ok) throw new Error(`خطأ في Google Calendar API: ${res.status}`);

  const data = await res.json() as { items?: GEvent[] };
  const items = data.items ?? [];

  const store = useMeetingsStore.getState();
  const currentIds = new Set(items.map((e) => e.id));

  // Remove stale Google events (deleted in Google Calendar)
  store.removeGoogleMeetings(currentIds);

  // Upsert current events
  let count = 0;
  for (const event of items) {
    const meeting = mapEvent(event);
    if (meeting) {
      store.upsertGoogleMeeting(meeting);
      count++;
    }
  }

  useGoogleCalendarStore.getState().setLastSync(count);
  return count;
}

// ── Listen for OAuth code emitted by Rust ─────────────────────────────────────

let unlistenFn: (() => void) | null = null;

export async function listenForOAuthCode(
  clientId: string,
  clientSecret: string,
  onSuccess: (count: number) => void,
  onError: (msg: string) => void
): Promise<void> {
  unlistenFn?.();
  unlistenFn = null;

  const { listen } = await import("@tauri-apps/api/event");
  unlistenFn = await listen<string>("google:oauth:code", async (event) => {
    unlistenFn?.();
    unlistenFn = null;
    try {
      await exchangeCode(clientId, clientSecret, event.payload);
      const count = await syncGoogleCalendar();
      onSuccess(count);
    } catch (err) {
      onError(String(err));
    }
  });
}

export function cancelOAuthListen(): void {
  unlistenFn?.();
  unlistenFn = null;
}
