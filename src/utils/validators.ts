const USER_ID_PATTERN = /^(C-)?\d{4}-\d{4}$/i;

export function isValidUserId(value: string) {
  return USER_ID_PATTERN.test(value.trim());
}
