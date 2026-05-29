import { isoDate } from "../stores/tasksStore";

export const QUICK_ESTIMATED_MINUTES = [15, 30, 60, 90, 120];

export function addTaskDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function quickTaskDates(base = new Date()) {
  return [
    { labelAr: "اليوم", labelEn: "Today", date: base },
    { labelAr: "بكرة", labelEn: "Tomorrow", date: addTaskDays(base, 1) },
    { labelAr: "بعد بكرة", labelEn: "After tomorrow", date: addTaskDays(base, 2) },
  ].map((item) => ({
    ...item,
    value: isoDate(item.date),
  }));
}
