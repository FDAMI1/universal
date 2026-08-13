import { NativeModule, requireNativeModule } from "expo";

export interface RawNotificationEvent {
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
}

export default requireNativeModule<PaymentNotificationListenerModule>(
  "PaymentNotificationListener",
);
