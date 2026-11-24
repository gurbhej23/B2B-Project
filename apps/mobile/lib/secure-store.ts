import AsyncStorage from '@react-native-async-storage/async-storage';

export const SecureSession = {
  async setItem(key: string, value: any): Promise<void> {
    if (value === undefined || value === null) {
      await this.removeItem(key);
      return;
    }

    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await AsyncStorage.setItem(key, stringValue);
  },

  async getItem(key: string): Promise<string | null> {
    return await AsyncStorage.getItem(key);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  async clear(): Promise<void> {
    await AsyncStorage.clear();
  },
};
