// Hard block native autolinking for expo-barcode-scanner.
// This package is deprecated in Expo SDK 54 (its required header
// ExpoModulesCore/EXBarcodeScannerInterface.h was removed). We migrated
// all scanning to expo-camera, but if anything ever re-introduces
// expo-barcode-scanner into node_modules via a transitive dep, this
// tells React Native (and Expo) to NOT generate a Pod for it on iOS
// and NOT include it on Android.
module.exports = {
  dependencies: {
    'expo-barcode-scanner': {
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
};
