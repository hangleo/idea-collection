import Constants, { ExecutionEnvironment } from 'expo-constants';

// expo-speech-recognition is a native module that does not exist in Expo Go.
// Importing it there crashes the app (same class of issue as expo-notifications
// in https://github.com/expo/expo/issues/52175), so it is only ever required
// inside development/production builds. In Expo Go, speech-to-text degrades
// to typing while recording.
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type SpeechModule = typeof import('expo-speech-recognition');

let Speech: SpeechModule | null = null;

if (!inExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Speech = require('expo-speech-recognition') as SpeechModule;
  } catch {
    Speech = null;
  }
}

export const speechAvailable = Speech !== null;

export function speechUnavailableReason(): string {
  if (inExpoGo) {
    return 'Speech-to-text needs a development build (npx expo run:android / npx expo run:ios). You can still type notes while recording.';
  }
  return 'Speech-to-text is not available on this device.';
}

export async function ensureSpeechPermissions(): Promise<boolean> {
  if (!Speech) return false;
  try {
    const response = await Speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return response.granted;
  } catch {
    return false;
  }
}

export interface SpeechSegment {
  startTimeMillis: number;
  endTimeMillis: number;
  segment: string;
}

export interface SpeechHandlers {
  onResult: (transcript: string, isFinal: boolean, segments: SpeechSegment[]) => void;
  onError: (code: string, message: string) => void;
  onEnd: () => void;
}

const DEVICE_LOCALE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  } catch {
    return 'en-US';
  }
})();

/**
 * Starts continuous speech recognition. Returns a cleanup function that
 * removes listeners, or null when speech recognition is unavailable.
 */
export function startSpeechRecognition(
  handlers: SpeechHandlers,
  locale = DEVICE_LOCALE,
): (() => void) | null {
  if (!Speech) return null;
  try {
    const mod = Speech.ExpoSpeechRecognitionModule;
    const subscriptions = [
      mod.addListener('result', (event) => {
        const best = event.results?.[0];
        if (best) {
          handlers.onResult(best.transcript, event.isFinal, best.segments ?? []);
        }
      }),
      mod.addListener('error', (event) => handlers.onError(event.error, event.message)),
      mod.addListener('end', () => handlers.onEnd()),
    ];
    mod.start({
      lang: locale,
      continuous: true,
      interimResults: true,
      addsPunctuation: true,
    });
    return () => subscriptions.forEach((sub) => sub.remove());
  } catch {
    return null;
  }
}

/** Gracefully stops recognition, emitting a final result if any. */
export function stopSpeechRecognition(): void {
  try {
    Speech?.ExpoSpeechRecognitionModule.stop();
  } catch {
    // not running
  }
}

/** Cancels recognition immediately without a final result. */
export function abortSpeechRecognition(): void {
  try {
    Speech?.ExpoSpeechRecognitionModule.abort();
  } catch {
    // not running
  }
}

export const speechDeviceLocale = DEVICE_LOCALE;
