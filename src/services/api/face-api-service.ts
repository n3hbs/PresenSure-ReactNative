export const FACE_API_BASE_URL =
  process.env.EXPO_PUBLIC_FACE_API_URL || 'https://n3hbs-face-verify-api.hf.space/python';

export type FaceVerificationResult = {
  success: boolean;
  verified: boolean;
  message?: string;
  score?: number;
};

async function resolveReferenceImagePayload(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:image')) {
    return imageUrl.split(',')[1] || imageUrl;
  }

  const isLocalHost =
    imageUrl.includes('192.168.') ||
    imageUrl.includes('localhost') ||
    imageUrl.includes('127.0.0.1') ||
    imageUrl.includes('10.0.');

  if (isLocalHost) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const b64 = reader.result.split(',')[1] || reader.result;
            resolve(b64);
          } else {
            resolve(imageUrl);
          }
        };
        reader.onerror = () => resolve(imageUrl);
        reader.readAsDataURL(blob);
      });
    } catch {
      return imageUrl;
    }
  }

  return imageUrl;
}

export async function verifyFaceApi(
  referenceImageUrl: string,
  capturedBase64: string,
): Promise<FaceVerificationResult> {
  try {
    const referencePayload = await resolveReferenceImagePayload(referenceImageUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${FACE_API_BASE_URL}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference_image: referencePayload,
        captured_image: capturedBase64,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        verified: false,
        message: `Server Error HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: Boolean(data.success),
      verified: Boolean(data.success && data.result?.verified),
      message: data.message || data.result?.message || (data.success && data.result?.verified ? 'Verified' : 'Face match failed'),
      score: data.result?.distance ?? data.result?.similarity,
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return {
        success: false,
        verified: false,
        message: 'Face API request timed out (20s).',
      };
    }
    return {
      success: false,
      verified: false,
      message: error instanceof Error ? error.message : 'Network error connecting to Face API',
    };
  }
}
