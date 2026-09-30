import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  LayoutDashboard,
  Receipt,
  Settings,
  ScrollText,
  Speaker,
} from "lucide-react-native";

import DashboardScreen from "@modules/dashboard/screens/DashboardScreen";
import PaymentHistoryScreen from "@modules/history/screens/PaymentHistoryScreen";
import SettingsScreen from "@modules/settings/screens/SettingsScreen";
import LogsScreen from "@modules/logs/screens/LogsScreen";
import DevicePairingScreen from "@modules/pairing/screens/DevicePairingScreen";
import NotificationAccessScreen from "@modules/notifications/screens/NotificationAccessScreen";
import SpeakerWifiSetupScreen from "@modules/pairing/screens/SpeakerWifiSetupScreen";

export type RootStackParamList = {
  MainTabs: undefined;
  NotificationAccess: undefined;
  SpeakerWifiSetup: undefined;
};

export type MainTabsParamList = {
  Dashboard: undefined;
  Speaker: undefined;
  History: undefined;
  Logs: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

// Gesture bars and home indicators vary by phone, so the bar is sized from the
// device's own bottom inset rather than a fixed per-platform guess.
function useTabOptions() {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarActiveTintColor: "#2563eb",
    tabBarInactiveTintColor: "#64748b",
    tabBarStyle: {
      backgroundColor: "#ffffff",
      borderTopColor: "#f1f5f9",
      borderTopWidth: 1,
      paddingBottom: insets.bottom + 6,
      paddingTop: 6,
      height: 58 + insets.bottom,
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: "600" as const,
      marginBottom: 2,
    },
  };
}

function MainTabs() {
  const screenOptions = useTabOptions();

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Speaker"
        component={DevicePairingScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Speaker size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={PaymentHistoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Receipt size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Logs"
        component={LogsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <ScrollText size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="NotificationAccess"
        component={NotificationAccessScreen}
      />
      <Stack.Screen
        name="SpeakerWifiSetup"
        component={SpeakerWifiSetupScreen}
      />
    </Stack.Navigator>
  );
}
