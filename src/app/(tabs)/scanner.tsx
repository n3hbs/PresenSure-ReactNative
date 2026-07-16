import { FoundationPlaceholderScreen } from '@/components/foundation-placeholder-screen';

export default function BleScannerPlaceholderScreen() {
  return (
    <FoundationPlaceholderScreen
      icon="bluetooth-outline"
      title="BLE not implemented"
      description="Bluetooth scanning and advertising are intentionally disabled in this foundation phase."
    />
  );
}
