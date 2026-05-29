export const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export const QUICK_TIMES = ["09:00", "12:00", "15:00", "18:00", "21:00"];

export function daysInMonth(month: number, year = new Date().getFullYear()) {
  return new Date(year, month, 0).getDate();
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toScheduleDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

export function scheduleDateFromParts(month: string, day: string) {
  if (!month || !day) return null;
  return `${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function splitScheduleDate(date: string | null) {
  if (!date) return { month: "", day: "" };
  const parts = date.split("-");
  const month = parts.length === 3 ? parts[1] : parts[0];
  const day = parts.length === 3 ? parts[2] : parts[1];
  return {
    month: month ? String(parseInt(month, 10)) : "",
    day: day ? String(parseInt(day, 10)) : "",
  };
}

export function formatScheduleDate(date: string | null, time: string | null) {
  if (!date) return "";
  const { month, day } = splitScheduleDate(date);
  if (!month || !day) return "";
  const monthLabel = MONTHS_AR[parseInt(month, 10) - 1] ?? month;
  const dateStr = `${parseInt(day, 10)} ${monthLabel}`;
  return time ? `${dateStr} · ${time}` : dateStr;
}

export function quickScheduleDates(base = new Date()) {
  return [
    { label: "اليوم", date: base },
    { label: "بكرة", date: addDays(base, 1) },
    { label: "بعد بكرة", date: addDays(base, 2) },
  ].map((item) => ({
    ...item,
    value: toScheduleDate(item.date),
    month: String(item.date.getMonth() + 1),
    day: String(item.date.getDate()),
  }));
}
