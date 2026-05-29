import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FontSize = "sm" | "md" | "lg" | "xl" | "2xl";
export type Theme = "dark" | "light";

export const fontSizePx: Record<FontSize, string> = {
  sm: "13px",
  md: "15px",
  lg: "17px",
  xl: "19px",
  "2xl": "22px",
};

type UIState = {
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  isTray: boolean;
  setIsTray: (v: boolean) => void;
  /** Width (px) of the right-side Today Tasks panel on Projects page */
  todayPanelWidth: number;
  setTodayPanelWidth: (w: number) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      fontSize: "md",
      setFontSize: (fontSize) => set({ fontSize }),
      theme: "light",
      setTheme: (theme) => set({ theme }),
      isTray: false,
      setIsTray: (isTray) => set({ isTray }),
      todayPanelWidth: 320,
      setTodayPanelWidth: (todayPanelWidth) =>
        set({ todayPanelWidth: Math.max(240, Math.min(720, todayPanelWidth)) }),
    }),
    {
      name: "heed:ui",
      partialize: (s) => ({
        fontSize: s.fontSize,
        theme: s.theme,
        todayPanelWidth: s.todayPanelWidth,
      }),
    }
  )
);
