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
