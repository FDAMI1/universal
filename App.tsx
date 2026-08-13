import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AppNavigator from "./src/navigation/AppNavigator";
import { usePaymentPipelineRunner } from "./src/modules/payment-parser/usePaymentPipelineRunner";
import { usePaymentHistoryStore } from "./src/shared/store/usePaymentHistoryStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function PaymentPipelineBoundary() {
  usePaymentPipelineRunner();

  useEffect(() => {
    usePaymentHistoryStore.getState().loadFromDb();
  }, []);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <NavigationContainer>
          <PaymentPipelineBoundary />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
