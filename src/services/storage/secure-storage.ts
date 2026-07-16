import * as SecureStore from 'expo-secure-store';

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainService: 'presensure.secure.storage',
};

export async function getSecureItem(key: string) {
  return SecureStore.getItemAsync(key, secureStoreOptions);
}

export async function setSecureItem(key: string, value: string) {
  await SecureStore.setItemAsync(key, value, secureStoreOptions);
}

export async function deleteSecureItem(key: string) {
  await SecureStore.deleteItemAsync(key, secureStoreOptions);
}
