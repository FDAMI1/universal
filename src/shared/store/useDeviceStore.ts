import { create } from "zustand";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

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
}

export const useDeviceStore = create<DeviceState>((set) => ({
  isHydrated: false,
  pairedDevice: null,
  connectionStatus: "disconnected",
  setHydrated: (hydrated) => set({ isHydrated: hydrated }),
  setPairedDevice: (device) => set({ pairedDevice: device }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
