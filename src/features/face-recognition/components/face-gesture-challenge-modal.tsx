import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/theme-provider';

type GestureStep = {
  id: string;
  instruction: string;
  icon: keyof typeof Ionicons.glyphMap;
  hint: string;
};

const GESTURE_STEPS: GestureStep[] = [
  {
    id: 'center',
    instruction: 'Look straight at the camera',
    icon: 'eye-outline',
    hint: 'Position your face inside the circle',
  },
  {
    id: 'smile',
    instruction: 'Smile gently',
    icon: 'happy-outline',
    hint: 'Show a clear smile for facial liveness check',
  },
  {
    id: 'blink',
    instruction: 'Blink your eyes slowly',
    icon: 'eye-sharp',
    hint: 'Close and open your eyes naturally',
  },
  {
    id: 'turn_right',
    instruction: 'Slightly turn your head right',
    icon: 'arrow-forward-circle-outline',
    hint: 'Rotate head slightly to verify 3D presence',
  },
];

type FaceGestureChallengeModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (verifiedAtIso: string) => void;
};

export function FaceGestureChallengeModal({
  visible,
  onClose,
  onSuccess,
}: FaceGestureChallengeModalProps) {
  const theme = useAppTheme();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [passed, setPassed] = useState(false);

  const currentStep = GESTURE_STEPS[currentStepIndex];
  const progressPercent = Math.round(((currentStepIndex + 1) / GESTURE_STEPS.length) * 100);

  useEffect(() => {
    if (visible) {
      setCurrentStepIndex(0);
      setIsVerifying(false);
      setPassed(false);
    }
  }, [visible]);

  function handleCompleteCurrentGesture() {
    if (currentStepIndex < GESTURE_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsVerifying(true);
      setTimeout(() => {
        setIsVerifying(false);
        setPassed(true);
        const nowIso = new Date().toISOString();
        setTimeout(() => {
          onSuccess(nowIso);
        }, 1200);
      }, 1500);
    }
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View
          className="rounded-t-[28px] border px-6 pb-8 pt-6"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          }}>
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View
                className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.colors.primarySoft }}>
                <Ionicons name="scan-circle-outline" size={24} color={theme.colors.primary} />
              </View>
              <View>
                <Text className="text-lg font-black" style={{ color: theme.colors.text }}>
                  Face Liveness Verification
                </Text>
                <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                  Gesture Challenge Required
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.colors.surfaceMuted }}>
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Progress Bar */}
          <View className="mt-5">
            <View className="flex-row justify-between text-xs font-bold mb-1">
              <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                Challenge Step {currentStepIndex + 1} of {GESTURE_STEPS.length}
              </Text>
              <Text className="text-xs font-black" style={{ color: theme.colors.primary }}>
                {progressPercent}%
              </Text>
            </View>
            <View
              className="h-2.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: theme.colors.surfaceMuted }}>
              <View
                className="h-full rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: theme.colors.primary,
                }}
              />
            </View>
          </View>

          {/* Camera Frame Circle / Verification Status */}
          <View className="my-6 items-center">
            <View
              className="relative h-44 w-44 items-center justify-center rounded-full border-4 shadow-lg"
              style={{
                borderColor: passed
                  ? theme.colors.success
                  : isVerifying
                  ? theme.colors.primary
                  : theme.colors.primary,
                backgroundColor: theme.colors.background,
              }}>
              {passed ? (
                <Ionicons name="checkmark-circle" size={72} color={theme.colors.success} />
              ) : isVerifying ? (
                <View className="items-center">
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text className="mt-3 text-xs font-black" style={{ color: theme.colors.text }}>
                    Validating Face...
                  </Text>
                </View>
              ) : (
                <View className="items-center px-3 text-center">
                  <Ionicons
                    name={currentStep?.icon ?? 'happy-outline'}
                    size={52}
                    color={theme.colors.primary}
                  />
                  <Text className="mt-2 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                    Live Camera Feed
                  </Text>
                </View>
              )}
            </View>

            {/* Current Gesture Instruction */}
            {!passed && !isVerifying && currentStep && (
              <View className="mt-5 items-center">
                <View
                  className="rounded-full px-3.5 py-1"
                  style={{ backgroundColor: theme.colors.primarySoft }}>
                  <Text
                    className="text-xs font-black uppercase tracking-wider"
                    style={{ color: theme.colors.primary }}>
                    Gesture Challenge #{currentStepIndex + 1}
                  </Text>
                </View>
                <Text
                  className="mt-2 text-center text-base font-black"
                  style={{ color: theme.colors.text }}>
                  {currentStep.instruction}
                </Text>
                <Text
                  className="mt-1 text-center text-xs font-bold"
                  style={{ color: theme.colors.textMuted }}>
                  {currentStep.hint}
                </Text>
              </View>
            )}

            {passed && (
              <View className="mt-5 items-center">
                <Text className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  Face Verification Passed!
                </Text>
                <Text className="mt-1 text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                  Submitting attendance record to server...
                </Text>
              </View>
            )}
          </View>

          {/* Action Trigger Button */}
          {!passed && !isVerifying && (
            <Pressable
              accessibilityRole="button"
              onPress={handleCompleteCurrentGesture}
              className="mt-2 min-h-[50px] flex-row items-center justify-center rounded-xl"
              style={{ backgroundColor: theme.colors.primary }}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text className="ml-2 text-base font-black text-white">
                {currentStepIndex < GESTURE_STEPS.length - 1
                  ? 'Perform Gesture & Next'
                  : 'Complete Face Challenge'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
