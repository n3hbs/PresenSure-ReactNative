import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import {
  Camera as FaceCamera,
  type Face,
} from 'react-native-vision-camera-face-detector';
import { SafeAreaView } from 'react-native-safe-area-context';

type LivenessStep = 'center' | 'eyes-open' | 'eyes-closed' | 'turn' | 'complete';

const STEP_COPY: Record<LivenessStep, string> = {
  center: 'Center one face in the frame',
  'eyes-open': 'Look straight at the camera',
  'eyes-closed': 'Blink now',
  turn: 'Great — turn your head to either side',
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.permissionScreen}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={42} color="#7C3AED" />
          </View>
          <Text style={styles.permissionTitle}>Camera access required</Text>
          <Text style={styles.permissionText}>
            PresenSure needs the front camera to perform the live face challenge. Images are not
            saved by this check.
          </Text>
          <Pressable
            onPress={() => (canRequestPermission ? requestPermission() : Linking.openSettings())}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>
              {canRequestPermission ? 'Allow camera' : 'Open settings'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="scan" size={26} color="#FFFFFF" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PRESENSURE</Text>
          <Text style={styles.title}>Face recognition</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.preview}>
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
            <View style={styles.noCamera}>
              <Ionicons name="camera-outline" size={44} color="#64748B" />
              <Text style={styles.noCameraText}>Front camera unavailable</Text>
            </View>
          )}
          <View style={styles.cameraShade} pointerEvents="none" />
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          {step === 'complete' && (
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={52} color="#22C55E" />
            </View>
          )}
        </View>

        <View style={[styles.challengeCard, step === 'complete' && styles.challengeSuccess]}>
          <View style={styles.challengeTop}>
            <View style={[styles.stepIcon, step === 'complete' && styles.stepIconSuccess]}>
              <Ionicons
                name={step === 'complete' ? 'shield-checkmark' : 'scan'}
                size={22}
                color={step === 'complete' ? '#15803D' : '#7C3AED'}
              />
            </View>
            <View style={styles.challengeCopy}>
              <Text style={styles.challengeLabel}>
                {step === 'complete' ? 'VERIFIED' : 'LIVE CHALLENGE'}
              </Text>
              <Text style={styles.challengeText}>{cameraError ?? STEP_COPY[step]}</Text>
            </View>
            <Text style={styles.faceCount}>{faceCount} face</Text>
          </View>
          <View style={styles.progressRow}>
            {['center', 'eyes-open', 'eyes-closed', 'turn'].map((item, index) => {
              const currentIndex = ['center', 'eyes-open', 'eyes-closed', 'turn', 'complete'].indexOf(
                step,
              );
              return (
                <View
                  key={item}
                  style={[styles.progressSegment, index < currentIndex && styles.progressComplete]}
                />
              );
            })}
          </View>
          {step === 'complete' && (
            <Pressable
              onPress={resetCheck}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Ionicons name="refresh" size={17} color="#166534" />
              <Text style={styles.retryText}>Run again</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.disclaimer}>
          Basic liveness check. Production identity verification needs enrollment and stronger
          anti-spoofing.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { marginLeft: 13 },
  eyebrow: { color: '#7C3AED', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#0F172A', fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  content: { flex: 1, paddingHorizontal: 20, paddingBottom: 12 },
  preview: {
    flex: 1,
    maxHeight: 480,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  noCamera: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  noCameraText: { color: '#475569', fontWeight: '700', marginTop: 10 },
  successBadge: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 38, height: 38, borderColor: '#7C3AED' },
  topLeft: { top: 24, left: 24, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  topRight: { top: 24, right: 24, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bottomLeft: {
    bottom: 24,
    left: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 24,
    right: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  challengeCard: {
    padding: 16,
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  challengeSuccess: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  challengeTop: { flexDirection: 'row', alignItems: 'center' },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconSuccess: { backgroundColor: '#DCFCE7' },
  challengeCopy: { flex: 1, marginLeft: 11 },
  challengeLabel: { color: '#7C3AED', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  challengeText: { color: '#0F172A', fontSize: 14, fontWeight: '800', marginTop: 3 },
  faceCount: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  progressRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#DDD6FE' },
  progressComplete: { backgroundColor: '#7C3AED' },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
  },
  retryText: { color: '#166534', fontSize: 13, fontWeight: '800' },
  disclaimer: { color: '#64748B', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 9 },
  permissionScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionIcon: {
    width: 82,
    height: 82,
    borderRadius: 26,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: { color: '#0F172A', fontSize: 22, fontWeight: '800', marginTop: 20 },
  permissionText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 9,
  },
  primaryButton: {
    minWidth: 180,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    marginTop: 24,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.82 },
});
