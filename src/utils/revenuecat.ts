import Purchases from "react-native-purchases";

const REVENUECAT_ANDROID_PUBLIC_SDK_KEY =
  "PASTE_REVENUECAT_ANDROID_PUBLIC_SDK_KEY_HERE";

let isRevenueCatInitialized = false;

export function initializeRevenueCat(): void {
  if (isRevenueCatInitialized) {
    return;
  }

  Purchases.configure({ apiKey: REVENUECAT_ANDROID_PUBLIC_SDK_KEY });
  isRevenueCatInitialized = true;
}
