import { Platform } from 'react-native';

/**
 * Request Apple's App-Tracking-Transparency permission ("allow tracking?" dialog).
 *
 * Apple's App-Review team rejected us under §5.1.2(i) for collecting Email,
 * Name, and User ID without prompting via AppTrackingTransparency. We call
 * this after a successful login / signup — at that point the user has already
 * committed to an interaction, which is the window Apple recommends.
 *
 * Safe to call on Android and Web — it no-ops.
 * Safe to call if the user has already decided — it returns the cached status
 * without re-prompting.
 *
 * Return values:
 *   - 'granted'     — user allowed tracking
 *   - 'denied'      — user declined
 *   - 'undetermined'— user hasn't decided yet (shouldn't happen post-call)
 *   - 'restricted'  — parental controls block prompt
 *   - 'unavailable' — iOS <14.5, simulator, Android, or web
 */
export async function requestTrackingPermission(): Promise<string> {
  if (Platform.OS !== 'ios') return 'unavailable';

  try {
    const mod = await import('expo-tracking-transparency');
    const { status } = await mod.requestTrackingPermissionsAsync();
    console.log(`📊 ATT status: ${status}`);
    return status;
  } catch (e) {
    // Expo Go / unsupported build — swallow
    console.log('📊 ATT unavailable:', e);
    return 'unavailable';
  }
}

export async function getTrackingStatus(): Promise<string> {
  if (Platform.OS !== 'ios') return 'unavailable';
  try {
    const mod = await import('expo-tracking-transparency');
    const { status } = await mod.getTrackingPermissionsAsync();
    return status;
  } catch {
    return 'unavailable';
  }
}
