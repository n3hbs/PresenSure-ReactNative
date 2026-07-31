function textToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToText(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeBlePayload(payload: unknown) {
  return textToBase64(JSON.stringify(payload));
}

export function decodeBlePayload<T>(value: string) {
  return JSON.parse(base64ToText(value)) as T;
}

export function decodeBase64AdvertisementData(base64: string | null | undefined): string | null {
  if (!base64) return null;
  try {
    const text = base64ToText(base64);
    // Check if the decoded text contains mostly printable ASCII characters
    if (/^[\x20-\x7E\s\r\n\t]*$/.test(text) && text.trim().length > 0) {
      return text;
    }
    // Return formatted hex bytes for raw binary payloads
    const binary = atob(base64);
    return Array.from(binary)
      .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase())
      .join(" ");
  } catch {
    return null;
  }
}

export function tryParseJsonPayload<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export type DecodedEsp32AdvertisementPayload = {
  protocolVersion: number;
  advertisementVersion: number;
  verificationMode: 'ble' | 'face' | 'ble_face';
  continuousChecking: boolean;
  sessionHash: string;
  timeWindow: number;
  verificationToken: string;
  deviceHash: string;
};

export function parseEsp32ManufacturerData(base64Data: string | null | undefined): DecodedEsp32AdvertisementPayload | null {
  if (!base64Data) return null;
  try {
    const binary = atob(base64Data);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    if (bytes.length < 23) return null;

    const protocolVersion = bytes[2];
    const flags = bytes[3];
    const advertisementVersion = bytes[4];

    const hasBle = (flags & 0x01) !== 0;
    const hasFace = (flags & 0x02) !== 0;
    const continuousChecking = (flags & 0x04) !== 0;

    let verificationMode: 'ble' | 'face' | 'ble_face' = 'ble';
    if (hasBle && hasFace) verificationMode = 'ble_face';
    else if (hasFace) verificationMode = 'face';
    else if (hasBle) verificationMode = 'ble';

    const toHex = (start: number, count: number) =>
      Array.from(bytes.slice(start, start + count))
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join("");

    const sessionHash = toHex(5, 4);
    const timeWindow =
      bytes[9] | (bytes[10] << 8) | (bytes[11] << 16) | (bytes[12] * 16777216);
    const verificationToken = toHex(13, 6);
    const deviceHash = toHex(19, 4);

    return {
      protocolVersion,
      advertisementVersion,
      verificationMode,
      continuousChecking,
      sessionHash,
      timeWindow,
      verificationToken,
      deviceHash,
    };
  } catch {
    return null;
  }
}


