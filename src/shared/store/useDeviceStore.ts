import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "expo-sqlite/kv-store";

export type ConnectionStatus =
  "disconnected" | "connecting" | "connected" | "error";

export interface PairedDevice {
  id: string;
  name: string;
  ipAddress: string;
  authToken: string;
  pairedAt: string;
}

interface DeviceState {
  isHydrated: boolean;
  pairedDevice: PairedDevice | null;
  connectionStatus: ConnectionStatus;
  setHydrated: (hydrated: boolean) => void;
  setPairedDevice: (device: PairedDevice | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  renameDevice: (name: string) => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      isHydrated: false,
      pairedDevice: null,
      connectionStatus: "disconnected",
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
      setPairedDevice: (device) => set({ pairedDevice: device }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      renameDevice: (name) =>
        set((state) =>
          state.pairedDevice
            ? { pairedDevice: { ...state.pairedDevice, name } }
            : state,
        ),
    }),
    {
      name: "universal-speaker-device",
      storage: createJSONStorage(() => AsyncStorage),
      // connectionStatus is live/derived at runtime (set by
      // useEsp32ConnectionManager on each launch) — never persist a stale
      // "connected" from the last session.
      partialize: (state) => ({ pairedDevice: state.pairedDevice }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
