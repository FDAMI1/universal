import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LayoutDashboard, Receipt, Settings, ScrollText } from "lucide-react-native";

import DashboardScreen from "@modules/dashboard/screens/DashboardScreen";
import PaymentHistoryScreen from "@modules/history/screens/PaymentHistoryScreen";
import SettingsScreen from "@modules/settings/screens/SettingsScreen";
import LogsScreen from "@modules/logs/screens/LogsScreen";
import DevicePairingScreen from "@modules/pairing/screens/DevicePairingScreen";
import NotificationAccessScreen from "@modules/notifications/screens/NotificationAccessScreen";

export type RootStackParamList = {
  MainTabs: undefined;
  DevicePairing: undefined;
  NotificationAccess: undefined;
};

export type MainTabsParamList = {
  Dashboard: undefined;
  History: undefined;
  Logs: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

const sharedTabOptions = {
  headerShown: false,
  tabBarActiveTintColor: "#2563eb",
  tabBarInactiveTintColor: "#64748b",
  tabBarStyle: {
    backgroundColor: "#ffffff",
    borderTopColor: "#f1f5f9",
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    paddingTop: 8,
    height: Platform.OS === "ios" ? 88 : 64,
  },
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: "600" as const,
    marginTop: 2,
  },
};

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={sharedTabOptions}>
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
        name="History"
        component={PaymentHistoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Receipt size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Logs"
        component={LogsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <ScrollText size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="DevicePairing" component={DevicePairingScreen} />
      <Stack.Screen name="NotificationAccess" component={NotificationAccessScreen} />
    </Stack.Navigator>
  );
}
