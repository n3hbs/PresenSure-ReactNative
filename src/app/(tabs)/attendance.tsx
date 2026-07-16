import { FoundationPlaceholderScreen } from '@/components/foundation-placeholder-screen';

export default function AttendanceScreen() {
  return (
    <FoundationPlaceholderScreen
      icon="shield-checkmark-outline"
      title="Attendance foundation"
      description="Attendance verification is reserved until BLE and face recognition are implemented. This screen keeps navigation ready without scanning or verification."
    />
  );
}
