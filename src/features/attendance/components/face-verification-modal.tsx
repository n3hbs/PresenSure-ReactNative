import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { Face, useFaceDetectorOutput } from 'react-native-vision-camera-face-detector';
import { Circle, Svg } from 'react-native-svg';
import { RefreshCw, ShieldAlert, ShieldCheck, X } from 'lucide-react-native';

import { useAuth } from '@/context/auth-context';
import { verifyFaceApi } from '@/services/api/face-api-service';
import { useAppTheme } from '@/providers/theme-provider';

// --- CONFIGURATION ---
const THEME_COLOR = '#208AEF';
const MAX_ATTEMPTS = 3;
const CHALLENGE_TIMEOUT = 5000;
const CAPTURE_COUNTDOWN = 3;

type ChallengeType =
  | 'turn_left'
  | 'turn_right'
  | 'smile'
  | 'blink'
  | 'look_up'
  | 'look_down';

type ChallengeConfig = {
  type: ChallengeType;
  instruction: string;
  icon: string;
};

const CHALLENGES: ChallengeConfig[] = [
  { type: 'turn_left', instruction: 'Turn Head Left', icon: '⬅️' },
  { type: 'turn_right', instruction: 'Turn Head Right', icon: '➡️' },
  { type: 'smile', instruction: 'Smile', icon: '🙂' },
  { type: 'blink', instruction: 'Blink Eyes', icon: '👁️' },
  { type: 'look_up', instruction: 'Look Up', icon: '⬆️' },
  { type: 'look_down', instruction: 'Look Down', icon: '⬇️' },
];

function readLocalFileAsBase64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (xhr.response) {
        const reader = new FileReader();
        reader.onloadend = function () {
          if (typeof reader.result === 'string') {
            const base64 = reader.result.split(',')[1] || reader.result;
            resolve(base64);
          } else {
            reject(new Error('FileReader non-string result'));
          }
        };
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(xhr.response);
      } else {
        reject(new Error('Empty response from XHR file read'));
      }
    };
    xhr.onerror = function () {
      fetch(filePath)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              const base64 = reader.result.split(',')[1] || reader.result;
              resolve(base64);
            } else {
              reject(new Error('Fetch FileReader non-string result'));
            }
          };
          reader.onerror = () => reject(new Error('Fetch FileReader error'));
          reader.readAsDataURL(blob);
        })
        .catch((err) => reject(new Error(`XHR & Fetch failed: ${err?.message || err}`)));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', filePath, true);
    xhr.send(null);
  });
}

const CameraViewMemo = React.memo(function CameraViewMemo({
  device,
  cameraRef,
  photoOutputRef,
  isActive,
  onFacesDetected,
}: {
  device: any;
  cameraRef: any;
  photoOutputRef: any;
  isActive: boolean;
  onFacesDetected: (faces: Face[]) => void;
}) {
  const faceDetectorOutput = useFaceDetectorOutput({
    onFacesDetected,
    onError: (err) => console.warn('Face detector output error:', err),
    performanceMode: 'accurate',
    runClassifications: true,
    runLandmarks: true,
    trackingEnabled: true,
  });

  const photoOutput = usePhotoOutput();

  useEffect(() => {
    photoOutputRef.current = photoOutput;
  }, [photoOutput, photoOutputRef]);

  const outputs = useMemo(
    () => [faceDetectorOutput, photoOutput],
    [faceDetectorOutput, photoOutput],
  );
  const VisionCameraComp = VisionCamera as any;

  return (
    <VisionCameraComp
      key={device.id}
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      outputs={outputs}
    />
  );
});

export interface FaceVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (verifiedAtIso: string) => void;
  scheduleTitle?: string;
}

export function FaceVerificationModal({
  visible,
  onClose,
  onSuccess,
  scheduleTitle,
}: FaceVerificationModalProps) {
  const theme = useAppTheme();
  const { user } = useAuth();

  const { hasPermission, requestPermission } = useCameraPermission();
  const { width, height } = useWindowDimensions();
  const device = useCameraDevice('front');
  const cameraRef = useRef<any>(null);
  const photoOutputRef = useRef<any>(null);

  const profileImageUri =
    user?.profile?.imagelink ??
    user?.profile_photo ??
    user?.profile_image ??
    user?.image ??
    user?.avatar;

  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [isCameraInitialized, setIsCameraInitialized] = useState(false);

  const [currentChallenge, setCurrentChallenge] = useState<ChallengeType | 'none'>('none');
  const [completedChallenges, setCompletedChallenges] = useState<ChallengeType[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [blinkCount, setBlinkCount] = useState(0);
  const [captureTimer, setCaptureTimer] = useState(CAPTURE_COUNTDOWN);
  const [isCapturing, setIsCapturing] = useState(false);
  const [requiredChallenges, setRequiredChallenges] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEyeStateRef = useRef<'open' | 'closed'>('open');
  const isVerificationActive = useRef(false);
  const availableChallengesRef = useRef<ChallengeType[]>([]);
  const challengeCompletedRef = useRef(false);
  const attemptsRef = useRef(0);
  const lastDetectionRef = useRef(0);
  const completedChallengesRef = useRef<ChallengeType[]>([]);
  const requiredChallengesRef = useRef(0);
  const hasInitializedRef = useRef(false);

  const currentChallengeRef = useRef<ChallengeType | 'none'>('none');
  const isProcessingRef = useRef(false);
  const blinkCountRef = useRef(0);
  const handleVerificationCompleteRef = useRef<() => void>(() => {});

  useEffect(() => {
    currentChallengeRef.current = currentChallenge;
    isProcessingRef.current = isProcessing;
    blinkCountRef.current = blinkCount;
    attemptsRef.current = verificationAttempts;
    completedChallengesRef.current = completedChallenges;
    requiredChallengesRef.current = requiredChallenges;
  }, [currentChallenge, isProcessing, blinkCount, verificationAttempts, completedChallenges, requiredChallenges]);

  const isCameraActiveProps =
    visible && isCameraActive && appState === 'active' && isCameraInitialized;

  const stopTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);
  }, []);

  const handleMaxAttemptsReached = useCallback(() => {
    setIsCameraActive(false);
    setIsProcessing(false);
    setVerificationStatus('failed');
    isVerificationActive.current = false;

    setTimeout(() => {
      Alert.alert(
        'Verification Failed',
        'Maximum attempts reached. Please ensure good lighting and try again.',
      );
    }, 500);
  }, []);

  const captureImageBase64 = useCallback(async (): Promise<{ base64: string | null; error?: string }> => {
    try {
      let rawPath: string | null = null;

      if (photoOutputRef.current) {
        try {
          const photoFile = await photoOutputRef.current.capturePhotoToFile(
            { flashMode: 'off', enableShutterSound: false },
            {},
          );
          rawPath = photoFile?.filePath ?? null;
        } catch (photoErr: any) {
          console.warn('capturePhotoToFile error:', photoErr);
        }
      }

      if (!rawPath && cameraRef.current?.takeSnapshot) {
        try {
          const snapshot = await cameraRef.current.takeSnapshot();
          rawPath = snapshot?.path ?? null;
        } catch (snapErr: any) {
          console.warn('takeSnapshot error:', snapErr);
        }
      }

      if (!rawPath && cameraRef.current?.takePhoto) {
        try {
          const photo = await cameraRef.current.takePhoto({ flash: 'off', enableShutterSound: false });
          rawPath = photo?.path ?? null;
        } catch (takeErr: any) {
          console.warn('takePhoto error:', takeErr);
        }
      }

      if (!rawPath) {
        return { base64: null, error: 'Could not capture photo from camera output' };
      }

      const fileUri =
        rawPath.startsWith('file://') || rawPath.startsWith('content://')
          ? rawPath
          : `file://${rawPath}`;

      try {
        const base64 = await readLocalFileAsBase64(fileUri);
        return { base64 };
      } catch (readErr: any) {
        return { base64: null, error: `Photo file read failed: ${readErr?.message || readErr}` };
      }
    } catch (err: any) {
      return { base64: null, error: err?.message || 'Unknown photo capture error' };
    }
  }, []);

  const handleVerificationError = useCallback(
    (reason?: string) => {
      const newAttempts = attemptsRef.current + 1;
      setVerificationAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        handleMaxAttemptsReached();
      } else {
        const message = reason || 'Camera or verification error occurred.';
        Alert.alert('Verification Error', `${message}\nAttempt ${newAttempts}/${MAX_ATTEMPTS}`);
        setIsProcessing(false);
        isVerificationActive.current = false;
      }
    },
    [handleMaxAttemptsReached],
  );

  const startCaptureCountdown = useCallback(() => {
    setIsCapturing(true);
    setCaptureTimer(CAPTURE_COUNTDOWN);
    if (captureTimerRef.current) clearInterval(captureTimerRef.current);

    captureTimerRef.current = setInterval(() => {
      setCaptureTimer((prev) => {
        if (prev <= 1) {
          if (captureTimerRef.current) clearInterval(captureTimerRef.current);
          setIsCapturing(false);
          handleVerificationCompleteRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleChallengeFailed = useCallback(() => {
    stopTimers();
    Alert.alert("Time's Up", 'Please react faster during the gesture challenge.');
  }, [stopTimers]);

  const startNewChallenge = useCallback(() => {
    if (attemptsRef.current >= MAX_ATTEMPTS) {
      handleMaxAttemptsReached();
      return;
    }

    if (completedChallengesRef.current.length >= requiredChallengesRef.current) {
      setCurrentChallenge('none');
      currentChallengeRef.current = 'none';
      startCaptureCountdown();
      return;
    }

    if (availableChallengesRef.current.length === 0) {
      availableChallengesRef.current = CHALLENGES.map((c) => c.type);
    }

    const randomIndex = Math.floor(Math.random() * availableChallengesRef.current.length);
    const selected = availableChallengesRef.current[randomIndex];

    setCurrentChallenge(selected);
    currentChallengeRef.current = selected;
    setBlinkCount(0);
    blinkCountRef.current = 0;
    lastEyeStateRef.current = 'open';
    challengeCompletedRef.current = false;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleChallengeFailed, CHALLENGE_TIMEOUT);
  }, [handleChallengeFailed, handleMaxAttemptsReached, startCaptureCountdown]);

  const initializeChallenges = useCallback(() => {
    stopTimers();
    setVerificationStatus('idle');
    const randomRequired = Math.floor(Math.random() * 2) + 2; // 2 or 3 challenges
    setRequiredChallenges(randomRequired);
    requiredChallengesRef.current = randomRequired;

    availableChallengesRef.current = CHALLENGES.map((c) => c.type);
    completedChallengesRef.current = [];
    setCompletedChallenges([]);
    startNewChallenge();
  }, [startNewChallenge, stopTimers]);

  const resetChallenges = useCallback(() => {
    hasInitializedRef.current = true;
    stopTimers();
    setIsCapturing(false);
    setIsProcessing(false);
    isVerificationActive.current = false;
    setCaptureTimer(CAPTURE_COUNTDOWN);
    setCompletedChallenges([]);
    completedChallengesRef.current = [];
    setCurrentChallenge('none');
    currentChallengeRef.current = 'none';
    setTimeout(initializeChallenges, 500);
  }, [initializeChallenges, stopTimers]);

  const handleVerificationComplete = useCallback(async () => {
    if (attemptsRef.current >= MAX_ATTEMPTS) {
      handleMaxAttemptsReached();
      return;
    }

    if (isVerificationActive.current) return;

    if (!profileImageUri) {
      Alert.alert('Missing Profile Photo', 'No registered profile photo found for face verification.');
      return;
    }

    isVerificationActive.current = true;
    setIsProcessing(true);

    try {
      const { base64: base64Photo, error: captureErr } = await captureImageBase64();

      if (base64Photo) {
        const result = await verifyFaceApi(profileImageUri, base64Photo);
        const newAttempts = attemptsRef.current + 1;
        setVerificationAttempts(newAttempts);

        if (result.verified) {
          setVerificationStatus('success');
          setIsProcessing(false);
          isVerificationActive.current = false;
          const nowIso = new Date().toISOString();

          setTimeout(() => {
            onSuccess(nowIso);
            onClose();
          }, 600);
        } else {
          setIsProcessing(false);
          isVerificationActive.current = false;

          if (newAttempts >= MAX_ATTEMPTS) {
            handleMaxAttemptsReached();
          } else {
            const failMessage = result.message || 'Face did not match reference profile.';
            Alert.alert(
              'Verification Failed',
              `${failMessage}\nAttempt ${newAttempts}/${MAX_ATTEMPTS}`,
              [
                {
                  text: 'Try Next Attempt',
                  onPress: () => {
                    setIsProcessing(false);
                    isVerificationActive.current = false;
                    resetChallenges();
                  },
                },
              ],
            );
          }
        }
      } else {
        throw new Error(captureErr || 'Could not process captured photo.');
      }
    } catch (error: any) {
      handleVerificationError(error?.message);
    } finally {
      setIsProcessing(false);
      isVerificationActive.current = false;
    }
  }, [captureImageBase64, handleMaxAttemptsReached, handleVerificationError, onClose, onSuccess, profileImageUri, resetChallenges]);

  useEffect(() => {
    handleVerificationCompleteRef.current = handleVerificationComplete;
  }, [handleVerificationComplete]);

  const handleChallengeSuccess = useCallback(() => {
    const activeChallenge = currentChallengeRef.current;
    if (challengeCompletedRef.current || activeChallenge === 'none') return;

    challengeCompletedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);

    const passedChallenge: ChallengeType = activeChallenge;
    availableChallengesRef.current = availableChallengesRef.current.filter(
      (t) => t !== passedChallenge,
    );

    const newCompleted = [...completedChallengesRef.current, passedChallenge];
    completedChallengesRef.current = newCompleted;
    setCompletedChallenges(newCompleted);

    setTimeout(startNewChallenge, 800);
  }, [startNewChallenge]);

  const checkChallenge = useCallback(
    (face: Face) => {
      const activeChallenge = currentChallengeRef.current;
      if (activeChallenge === 'none' || isProcessingRef.current || challengeCompletedRef.current) return;

      switch (activeChallenge) {
        case 'turn_left':
          if (face.yawAngle > 15) handleChallengeSuccess();
          break;
        case 'turn_right':
          if (face.yawAngle < -15) handleChallengeSuccess();
          break;
        case 'smile':
          if (face.smilingProbability != null && face.smilingProbability > 0.65) handleChallengeSuccess();
          break;
        case 'blink': {
          const leftEye = face.leftEyeOpenProbability ?? 1;
          const rightEye = face.rightEyeOpenProbability ?? 1;
          const leftClosed = leftEye < 0.35;
          const rightClosed = rightEye < 0.35;
          const bothOpen = leftEye > 0.65 && rightEye > 0.65;

          if (leftClosed && rightClosed && lastEyeStateRef.current === 'open') {
            const nextBlink = blinkCountRef.current + 1;
            blinkCountRef.current = nextBlink;
            setBlinkCount(nextBlink);
            if (nextBlink >= 2) handleChallengeSuccess();
          }
          lastEyeStateRef.current = bothOpen ? 'open' : 'closed';
          break;
        }
        case 'look_up':
          if (face.pitchAngle > 12) handleChallengeSuccess();
          break;
        case 'look_down':
          if (face.pitchAngle < -12) handleChallengeSuccess();
          break;
      }
    },
    [handleChallengeSuccess],
  );

  const handleFacesDetection = useCallback(
    (faces: Face[]) => {
      const now = Date.now();
      if (now - lastDetectionRef.current < 200) return;
      lastDetectionRef.current = now;

      if (faces.length > 0 && !isProcessingRef.current) {
        checkChallenge(faces[0]);
      }
    },
    [checkChallenge],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setAppState(nextAppState);
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const initCamera = async () => {
      if (!hasPermission) {
        setIsCameraInitialized(false);
        await requestPermission();
      } else {
        const timeout = setTimeout(() => {
          setIsCameraInitialized(true);
        }, 500);
        return () => clearTimeout(timeout);
      }
    };
    initCamera();
  }, [hasPermission, requestPermission, visible]);

  useEffect(() => {
    if (!visible) return;
    if (
      hasPermission &&
      device &&
      isCameraInitialized &&
      profileImageUri &&
      !hasInitializedRef.current
    ) {
      hasInitializedRef.current = true;
      const timeout = setTimeout(() => {
        initializeChallenges();
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [hasPermission, device, isCameraInitialized, profileImageUri, initializeChallenges, visible]);

  const handleModalClose = () => {
    stopTimers();
    hasInitializedRef.current = false;
    setIsCameraActive(false);
    onClose();
  };

  if (!visible) return null;

  const currentData = CHALLENGES.find((c) => c.type === currentChallenge);
  const OVAL_W = width * 0.82;
  const OVAL_H = height * 0.52;
  const centerX = (width - OVAL_W) / 2;
  const centerY = (height - OVAL_H) / 2;
  const radius = OVAL_W / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = requiredChallenges > 0 ? (completedChallenges.length / requiredChallenges) * 100 : 0;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleModalClose}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* CLOSE BUTTON */}
        <TouchableOpacity
          onPress={handleModalClose}
          style={styles.closeButton}
          activeOpacity={0.7}
          accessibilityLabel="Close Face Verification Modal">
          <X size={20} color="#FFF" />
        </TouchableOpacity>

        {!profileImageUri ? (
          <View style={styles.centerContainer}>
            <ShieldAlert size={48} color={theme.colors.danger} />
            <Text style={styles.errorTitle}>Profile Photo Required</Text>
            <Text style={styles.errorSubtitle}>
              You must have a registered profile photo to perform face recognition attendance verification.
            </Text>
            <TouchableOpacity
              onPress={handleModalClose}
              style={[styles.actionButton, { backgroundColor: THEME_COLOR }]}>
              <Text style={styles.actionButtonText}>Back to Schedule</Text>
            </TouchableOpacity>
          </View>
        ) : !device || !hasPermission || !isCameraInitialized ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={THEME_COLOR} />
            <Text style={styles.loadingText}>Initializing Face Recognition Camera...</Text>
          </View>
        ) : verificationAttempts >= MAX_ATTEMPTS || verificationStatus === 'failed' ? (
          <View style={styles.centerContainer}>
            <ShieldAlert size={56} color="#EF4444" />
            <Text style={styles.maxAttemptsTitle}>Maximum Attempts Reached</Text>
            <Text style={styles.maxAttemptsSubtitle}>
              We could not verify your identity via face recognition. Please ensure good lighting and face camera directly.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setVerificationAttempts(0);
                setIsCameraActive(true);
                isVerificationActive.current = false;
                resetChallenges();
              }}
              style={[styles.actionButton, { backgroundColor: THEME_COLOR }]}>
              <RefreshCw size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.actionButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {isCameraActive && (
              <CameraViewMemo
                device={device}
                cameraRef={cameraRef}
                photoOutputRef={photoOutputRef}
                isActive={isCameraActiveProps}
                onFacesDetected={handleFacesDetection}
              />
            )}

            <View style={styles.overlay}>
              {/* FLOATING RETRY BUTTON */}
              <TouchableOpacity
                onPress={resetChallenges}
                style={styles.retryHeaderButton}
                activeOpacity={0.7}
                accessibilityLabel="Retry Face Verification">
                <RefreshCw size={16} color="#FFF" />
                <Text style={styles.retryHeaderText}>Retry</Text>
              </TouchableOpacity>

              {/* TOP SECTION: Instructions & Badges */}
              <View style={styles.topSection}>
                {scheduleTitle ? (
                  <View style={styles.titleBadge}>
                    <Text style={styles.titleBadgeText} numberOfLines={1}>
                      {scheduleTitle}
                    </Text>
                  </View>
                ) : null}

                {!isProcessing && !isCapturing && currentData ? (
                  <View style={styles.challengeContainer}>
                    <Text style={styles.directionIcon}>{currentData.icon}</Text>
                    <Text style={styles.challengeText}>{currentData.instruction}</Text>
                    {currentChallenge === 'blink' && (
                      <Text style={styles.subText}>Blinks: {blinkCount}/2</Text>
                    )}
                  </View>
                ) : isProcessing ? (
                  <View style={styles.processingBadge}>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.processingText}>Verifying Face Matching...</Text>
                  </View>
                ) : verificationStatus === 'success' ? (
                  <View style={[styles.processingBadge, { backgroundColor: '#10B981' }]}>
                    <ShieldCheck size={20} color="#FFF" />
                    <Text style={styles.processingText}>Face Verified!</Text>
                  </View>
                ) : null}
              </View>

              {/* CENTER CUTOUT & PROGRESS RING */}
              <View
                style={[
                  styles.cutoutContainer,
                  { top: centerY, left: centerX, width: OVAL_W, height: OVAL_H },
                ]}>
                <View style={[styles.bracket, styles.bracketTL]} />
                <View style={[styles.bracket, styles.bracketTR]} />
                <View style={[styles.bracket, styles.bracketBL]} />
                <View style={[styles.bracket, styles.bracketBR]} />

                <View style={styles.progressRing}>
                  <Svg width={OVAL_W} height={OVAL_W}>
                    <Circle
                      cx={OVAL_W / 2}
                      cy={OVAL_W / 2}
                      r={radius - 5}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth={4}
                      fill="transparent"
                    />
                    <Circle
                      cx={OVAL_W / 2}
                      cy={OVAL_W / 2}
                      r={radius - 5}
                      stroke={THEME_COLOR}
                      strokeWidth={6}
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      transform={`rotate(-90 ${OVAL_W / 2} ${OVAL_W / 2})`}
                    />
                  </Svg>
                </View>

                {isCapturing && (
                  <View style={styles.centerContent}>
                    <Text style={styles.countdownText}>{captureTimer}</Text>
                    <Text style={styles.statusText}>Hold Still</Text>
                  </View>
                )}
              </View>

              {/* BOTTOM SECTION: Attempts & Status */}
              <View style={styles.bottomSection}>
                <Text style={styles.footerTitle}>Student Attendance Face Recognition</Text>
                <Text style={styles.footerSubtitle}>
                  Attempt {verificationAttempts + 1} of {MAX_ATTEMPTS}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 16,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  maxAttemptsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 16,
  },
  maxAttemptsSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    marginTop: 20,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 32,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 40,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  topSection: {
    marginTop: Platform.OS === 'ios' ? 50 : 30,
    alignItems: 'center',
    width: '100%',
    minHeight: 120,
    justifyContent: 'center',
  },
  titleBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxWidth: '80%',
  },
  titleBadgeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  challengeContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 15,
    paddingHorizontal: 36,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  directionIcon: {
    fontSize: 44,
    marginBottom: 4,
    color: '#FFF',
  },
  challengeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: THEME_COLOR,
    marginTop: 4,
    fontWeight: 'bold',
  },
  processingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
  },
  processingText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  cutoutContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  progressRing: {
    position: 'absolute',
  },
  bracket: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: THEME_COLOR,
    borderWidth: 4,
  },
  bracketTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 20 },
  bracketTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 20 },
  bracketBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 20 },
  bracketBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 20 },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  statusText: {
    fontSize: 18,
    color: THEME_COLOR,
    fontWeight: '600',
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomSection: {
    marginBottom: 40,
    alignItems: 'center',
    width: '100%',
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
  },
  footerSubtitle: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 4,
    fontWeight: 'bold',
  },
  retryHeaderButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 32,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 30,
  },
  retryHeaderText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
});
