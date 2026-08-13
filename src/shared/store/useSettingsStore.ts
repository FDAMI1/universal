import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "expo-sqlite/kv-store";
import { PaymentSource } from "@shared/types/payment";

// PhonePe Business and Paytm Business are independent packages, so each
// gets its own toggle. Google Pay personal and business share ONE Android
// package (see PDR Module 1) — a user has one or the other installed, never
// both distinctly — so it's a single toggle + a mode, not two toggles.
export type ToggleableSource = "phonepe_business" | "paytm_business" | "google_pay";
export type GooglePayMode = "business" | "personal";

interface SettingsState {
  enabledSources: Record<ToggleableSource, boolean>;
  googlePayMode: GooglePayMode;
  smsEnabled: boolean;
  smsPackageName: string;
  language: string;
  volume: number; // 0-1
  minimumAmount: number; // paise
  duplicateTimeoutSeconds: number;
  voiceStyle: string;
  setSourceEnabled: (source: ToggleableSource, enabled: boolean) => void;
  setGooglePayMode: (mode: GooglePayMode) => void;
  setSmsEnabled: (enabled: boolean) => void;
  setSmsPackageName: (packageName: string) => void;
  setLanguage: (language: string) => void;
  setVolume: (volume: number) => void;
  setMinimumAmount: (amount: number) => void;
  setDuplicateTimeout: (seconds: number) => void;
  setVoiceStyle: (style: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      enabledSources: {
        phonepe_business: true,
        paytm_business: true,
        google_pay: true,
      },
      googlePayMode: "business",
      smsEnabled: false,
      smsPackageName: "",
      language: "en-IN",
      volume: 0.8,
      minimumAmount: 0,
      duplicateTimeoutSeconds: 30,
      voiceStyle: "default",
      setSourceEnabled: (source, enabled) =>
        set((state) => ({
          enabledSources: { ...state.enabledSources, [source]: enabled },
        })),
      setGooglePayMode: (mode) => set({ googlePayMode: mode }),
      setSmsEnabled: (enabled) => set({ smsEnabled: enabled }),
      setSmsPackageName: (packageName) => set({ smsPackageName: packageName }),
      setLanguage: (language) => set({ language }),
      setVolume: (volume) => set({ volume }),
      setMinimumAmount: (amount) => set({ minimumAmount: amount }),
      setDuplicateTimeout: (seconds) => set({ duplicateTimeoutSeconds: seconds }),
      setVoiceStyle: (style) => set({ voiceStyle: style }),
    }),
    {
      name: "universal-speaker-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
