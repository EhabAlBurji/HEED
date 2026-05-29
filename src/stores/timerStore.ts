import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TimerMode = "stopwatch" | "pomodoro";

export type ActiveTask = {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  categoryColor?: string | null;
};

type TimerState = {
  mode: TimerMode;
  activeTask: ActiveTask | null;
  startedAt: number | null; // epoch ms when current run began
  accumulatedSeconds: number; // total seconds completed across previous runs of this task
  isRunning: boolean;
  sessionId: string | null; // current Supabase session row id

  // Pomodoro state
  pomodoro: {
    workMinutes: number;
    breakMinutes: number;
    longBreakMinutes: number;
    cyclesBeforeLongBreak: number;
    completedCycles: number;
    phase: "work" | "break" | "longBreak";
  };

  startTask: (task: ActiveTask, sessionId: string | null) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  tick: () => void;
  setMode: (mode: TimerMode) => void;
  setPomodoroConfig: (cfg: Partial<TimerState["pomodoro"]>) => void;
  getElapsedSeconds: () => number;
};

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      mode: "stopwatch",
      activeTask: null,
      startedAt: null,
      accumulatedSeconds: 0,
      isRunning: false,
      sessionId: null,
      pomodoro: {
        workMinutes: 25,
        breakMinutes: 5,
        longBreakMinutes: 15,
        cyclesBeforeLongBreak: 4,
        completedCycles: 0,
        phase: "work",
      },

      startTask: (task, sessionId) =>
        set({
          activeTask: task,
          startedAt: Date.now(),
          accumulatedSeconds: 0,
          isRunning: true,
          sessionId,
        }),

      pause: () => {
        const { startedAt, accumulatedSeconds, isRunning } = get();
        if (!isRunning || startedAt === null) return;
        const delta = Math.floor((Date.now() - startedAt) / 1000);
        set({
          isRunning: false,
          startedAt: null,
          accumulatedSeconds: accumulatedSeconds + delta,
        });
      },

      resume: () => {
        const { isRunning, activeTask } = get();
        if (isRunning || !activeTask) return;
        set({ isRunning: true, startedAt: Date.now() });
      },

      stop: () =>
        set({
          activeTask: null,
          startedAt: null,
          accumulatedSeconds: 0,
          isRunning: false,
          sessionId: null,
        }),

      tick: () => {
        // No-op: getElapsedSeconds is computed; components subscribe to a heartbeat instead.
      },

      setMode: (mode) => set({ mode }),
      setPomodoroConfig: (cfg) =>
        set((s) => ({ pomodoro: { ...s.pomodoro, ...cfg } })),

      getElapsedSeconds: () => {
        const { startedAt, accumulatedSeconds, isRunning } = get();
        if (!isRunning || startedAt === null) return accumulatedSeconds;
        return accumulatedSeconds + Math.floor((Date.now() - startedAt) / 1000);
      },
    }),
    {
      name: "mindora:timer",
      partialize: (s) => ({
        mode: s.mode,
        pomodoro: s.pomodoro,
      }),
    }
  )
);
