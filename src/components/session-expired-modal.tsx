import { AlertTriangle } from 'lucide-react-native';
import { Modal, Pressable, Text, View } from 'react-native';

type SessionExpiredModalProps = {
  visible: boolean;
  onConfirm: () => void;
};

export function SessionExpiredModal({ visible, onConfirm }: SessionExpiredModalProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onConfirm}>
      <View className="flex-1 items-center justify-center bg-slate-900/60 px-6">
        <View className="w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
          <View className="items-center text-center">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <AlertTriangle size={28} color="#D97706" />
            </View>

            <Text className="text-xl font-black text-slate-900">
              Session Expired
            </Text>

            <Text className="mt-2 text-center text-sm font-semibold leading-5 text-slate-600">
              Your login session has expired. Please sign in again to continue.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              className="mt-6 w-full rounded-2xl bg-blue-600 py-3.5 items-center justify-center active:bg-blue-700">
              <Text className="text-base font-extrabold text-white">
                OK
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
