import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Camera as FaceCamera, type Face } from 'react-native-vision-camera-face-detector';
import { SafeAreaView } from 'react-native-safe-area-context';

type LivenessStep = 'center' | 'eyes-open' | 'eyes-closed' | 'turn' | 'complete';

const STEPS: LivenessStep[] = ['center', 'eyes-open', 'eyes-closed', 'turn', 'complete'];

const STEP_COPY: Record<LivenessStep, string> = {
  center: 'Center one face in the frame',
  'eyes-open': 'Look straight at the camera',
  'eyes-closed': 'Blink now',
  turn: 'Great - turn your head to either side',
  complete: 'Liveness check passed',
};

export default function FaceRecognitionScreen() {
  const device = useCameraDevice('front');
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const isFocused = useIsFocused();
  const [step, setStep] = useState<LivenessStep>('center');
  const [faceCount, setFaceCount] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const stepRef = useRef<LivenessStep>('center');
  const stableFrames = useRef(0);
  const noFaceSince = useRef<number | null>(null);

  const moveTo = useCallback((next: LivenessStep) => {
    stepRef.current = next;
    stableFrames.current = 0;
    setStep(next);
  }, []);

  const resetCheck = useCallback(() => {
    moveTo('center');
    setFaceCount(0);
    noFaceSince.current = null;
  }, [moveTo]);

  const handleFacesDetected = useCallback(
    (faces: Face[]) => {
      setFaceCount(faces.length);

      if (faces.length !== 1) {
        stableFrames.current = 0;
        if (faces.length > 1) {
          moveTo('center');
          noFaceSince.current = null;
        } else if (noFaceSince.current === null) {
          noFaceSince.current = Date.now();
        } else if (Date.now() - noFaceSince.current > 1_200) {
          moveTo('center');
        }
        return;
      }

      noFaceSince.current = null;
      const face = faces[0];
      const leftEye = face.leftEyeOpenProbability ?? 1;
      const rightEye = face.rightEyeOpenProbability ?? 1;
      const eyesOpen = leftEye > 0.72 && rightEye > 0.72;
      const eyesClosed = leftEye < 0.35 && rightEye < 0.35;
      const lookingForward = Math.abs(face.yawAngle) < 10 && Math.abs(face.rollAngle) < 12;
      const headTurned = Math.abs(face.yawAngle) > 18;

      switch (stepRef.current) {
        case 'center':
          stableFrames.current = lookingForward ? stableFrames.current + 1 : 0;
          if (stableFrames.current >= 4) moveTo('eyes-open');
          break;
        case 'eyes-open':
          stableFrames.current = eyesOpen ? stableFrames.current + 1 : 0;
          if (stableFrames.current >= 3) moveTo('eyes-closed');
          break;
        case 'eyes-closed':
          if (eyesClosed) {
            stableFrames.current += 1;
          } else if (stableFrames.current >= 2 && eyesOpen) {
            moveTo('turn');
          }
          break;
        case 'turn':
          stableFrames.current = headTurned ? stableFrames.current + 1 : 0;
          if (stableFrames.current >= 4) moveTo('complete');
          break;
        case 'complete':
          break;
      }
    },
    [moveTo],
  );

  if (!hasPermission) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50">
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-[82px] w-[82px] items-center justify-center rounded-[26px] bg-violet-100">
            <Ionicons name="camera-outline" size={42} color="#7C3AED" />
          </View>
          <Text className="mt-5 text-[22px] font-extrabold text-slate-950">Camera access required</Text>
          <Text className="mt-[9px] text-center text-sm leading-[21px] text-slate-500">
            PresenSure needs the front camera to perform the live face challenge. Images are not saved by this check.
          </Text>
          <Pressable
            onPress={() => (canRequestPermission ? requestPermission() : Linking.openSettings())}
            className="mt-6 min-w-[180px] items-center rounded-[14px] bg-violet-600 px-[22px] py-3.5"
            style={({ pressed }) => pressed && { opacity: 0.82 }}>
            <Text className="text-[15px] font-extrabold text-white">
              {canRequestPermission ? 'Allow camera' : 'Open settings'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currentIndex = STEPS.indexOf(step);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="flex-row items-center px-5 pb-[18px] pt-3">
        <View className="h-12 w-12 items-center justify-center rounded-[15px] bg-violet-600">
          <Ionicons name="scan" size={26} color="#FFFFFF" />
        </View>
        <View className="ml-[13px]">
          <Text className="text-[11px] font-extrabold tracking-[1.5px] text-violet-600">PRESENSURE</Text>
          <Text className="text-[27px] font-extrabold text-slate-950">Face recognition</Text>
        </View>
      </View>

      <View className="flex-1 px-5 pb-3">
        <View className="max-h-[480px] flex-1 items-center justify-center overflow-hidden rounded-[28px] border border-violet-200 bg-violet-50">
          {device ? (
            <FaceCamera
              device={device}
              isActive={isFocused}
              cameraFacing="front"
              outputResolution="preview"
              performanceMode="fast"
              runClassifications
              minFaceSize={0.2}
              trackingEnabled
              onFacesDetected={handleFacesDetected}
              onError={(error) => setCameraError(error.message)}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View className="absolute inset-0 items-center justify-center bg-violet-50">
              <Ionicons name="camera-outline" size={44} color="#64748B" />
              <Text className="mt-2.5 font-bold text-slate-600">Front camera unavailable</Text>
            </View>
          )}
          <View className="absolute inset-0 bg-slate-900/10" pointerEvents="none" />
          <View className="absolute left-6 top-6 h-[38px] w-[38px] rounded-tl-lg border-l-[3px] border-t-[3px] border-violet-600" />
          <View className="absolute right-6 top-6 h-[38px] w-[38px] rounded-tr-lg border-r-[3px] border-t-[3px] border-violet-600" />
          <View className="absolute bottom-6 left-6 h-[38px] w-[38px] rounded-bl-lg border-b-[3px] border-l-[3px] border-violet-600" />
          <View className="absolute bottom-6 right-6 h-[38px] w-[38px] rounded-br-lg border-b-[3px] border-r-[3px] border-violet-600" />
          {step === 'complete' && (
            <View className="h-[82px] w-[82px] items-center justify-center rounded-full bg-white/95">
              <Ionicons name="checkmark-circle" size={52} color="#22C55E" />
            </View>
          )}
        </View>

        <View
          className={`mt-3.5 rounded-[18px] border p-4 ${
            step === 'complete' ? 'border-green-200 bg-green-50' : 'border-violet-200 bg-violet-50'
          }`}>
          <View className="flex-row items-center">
            <View
              className={`h-[42px] w-[42px] items-center justify-center rounded-[13px] ${
                step === 'complete' ? 'bg-green-100' : 'bg-violet-100'
              }`}>
              <Ionicons
                name={step === 'complete' ? 'shield-checkmark' : 'scan'}
                size={22}
                color={step === 'complete' ? '#15803D' : '#7C3AED'}
              />
            </View>
            <View className="ml-[11px] flex-1">
              <Text className="text-[10px] font-black tracking-[1.1px] text-violet-600">
                {step === 'complete' ? 'VERIFIED' : 'LIVE CHALLENGE'}
              </Text>
              <Text className="mt-1 text-sm font-extrabold text-slate-950">
                {cameraError ?? STEP_COPY[step]}
              </Text>
            </View>
            <Text className="text-[11px] font-bold text-slate-500">{faceCount} face</Text>
          </View>

          <View className="mt-3.5 flex-row gap-1.5">
            {['center', 'eyes-open', 'eyes-closed', 'turn'].map((item, index) => (
              <View
                key={item}
                className={`h-1 flex-1 rounded-sm ${index < currentIndex ? 'bg-violet-600' : 'bg-violet-200'}`}
              />
            ))}
          </View>

          {step === 'complete' && (
            <Pressable
              onPress={resetCheck}
              className="mt-3.5 flex-row items-center justify-center gap-[7px] rounded-[10px] bg-green-100 py-2"
              style={({ pressed }) => pressed && { opacity: 0.82 }}>
              <Ionicons name="refresh" size={17} color="#166534" />
              <Text className="text-[13px] font-extrabold text-green-800">Run again</Text>
            </Pressable>
          )}
        </View>

        <Text className="mt-[9px] text-center text-[11px] leading-4 text-slate-500">
          Basic liveness check. Production identity verification needs enrollment and stronger anti-spoofing.
        </Text>
      </View>
    </SafeAreaView>
  );
}
