import { create } from "zustand";
import { PaymentSource } from "@shared/types/payment";

interface SettingsState {
  enabledSources: Record<PaymentSource, boolean>;
  language: string;
  volume: number; // 0-1
  minimumAmount: number; // paise
  duplicateTimeoutSeconds: number;
  voiceStyle: string;
  setSourceEnabled: (source: PaymentSource, enabled: boolean) => void;
  setLanguage: (language: string) => void;
  setVolume: (volume: number) => void;
  setMinimumAmount: (amount: number) => void;
  setDuplicateTimeout: (seconds: number) => void;
  setVoiceStyle: (style: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  enabledSources: {
    phonepe_business: true,
    paytm_business: true,
    google_pay: true,
    google_pay_personal: true,
    bank_sms: true,
  },
  language: "en-IN",
  volume: 0.8,
  minimumAmount: 0,
  duplicateTimeoutSeconds: 30,
  voiceStyle: "default",
  setSourceEnabled: (source, enabled) =>
    set((state) => ({
      enabledSources: { ...state.enabledSources, [source]: enabled },
    })),
  setLanguage: (language) => set({ language }),
  setVolume: (volume) => set({ volume }),
  setMinimumAmount: (amount) => set({ minimumAmount: amount }),
  setDuplicateTimeout: (seconds) => set({ duplicateTimeoutSeconds: seconds }),
  setVoiceStyle: (style) => set({ voiceStyle: style }),
}));
