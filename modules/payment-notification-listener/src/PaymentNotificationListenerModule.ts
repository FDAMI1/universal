import { NativeModule, requireNativeModule } from "expo";

export interface RawNotificationEvent {
  /** The native fallback already announced this one while JS was not running. */
  announcedNatively?: boolean;
  packageName: string;
  postTimeMillis: number;
  title: string | null;
  text: string | null;
  bigText: string | null;
  subText: string | null;
}

export type PaymentNotificationListenerEvents = {
  onPaymentNotification: (event: RawNotificationEvent) => void;
} & Record<string, (...args: any[]) => void>;

declare class PaymentNotificationListenerModule extends NativeModule<PaymentNotificationListenerEvents> {
  isNotificationAccessGranted(): boolean;
  isListenerConnected(): boolean;
  openNotificationAccessSettings(): void;
  setEnabledSourcePackages(packages: string[]): void;
  getEnabledSourcePackages(): string[];
  startBridgeService(): void;
  stopBridgeService(): void;
  requestListenerRebind(): void;
  /** The phone's messaging app, which is what shows bank SMS. Null if unknown. */
  getDefaultSmsPackage(): string | null;
  /** Where the fallback announcer should send payments; empty strings clear it. */
  setSpeakerTarget(ip: string, deviceId: string, token: string): void;
  /** Troubleshooting: forward notifications from every app, not just payment ones. */
  setCaptureAllNotifications(enabled: boolean): void;
  isCaptureAllNotifications(): boolean;
  /** False while Android is allowed to doze the app and stall announcements. */
  isBatteryOptimizationIgnored(): boolean;
  /** Opens the exemption prompt (or the list it lives in). False if neither exists. */
  requestIgnoreBatteryOptimizations(): boolean;
  /** True on skins (Xiaomi, Oppo, Vivo...) that have their own autostart screen. */
  hasAutoStartSettings(): boolean;
  openAutoStartSettings(): boolean;
}

export default requireNativeModule<PaymentNotificationListenerModule>(
  "PaymentNotificationListener",
);
