import { FoundationPlaceholderScreen } from '@/components/foundation-placeholder-screen';

export default function FaceRecognitionPlaceholderScreen() {
  return (
    <FoundationPlaceholderScreen
      icon="scan-outline"
      title="Face recognition not implemented"
      description="Camera capture, liveness checks, and face matching are intentionally disabled in this foundation phase."
    />
  );
}
