import type { UserProfile } from '../types/health';
import { DEFAULT_PROFILE } from '../types/health';

const PROFILE_STORAGE_KEY = 'user_profile';

export const DEFAULT_USER_PROFILE: UserProfile = DEFAULT_PROFILE;

export function getUserProfile(): UserProfile {
  if (typeof window === 'undefined') {
    return DEFAULT_USER_PROFILE;
  }

  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      saveUserProfile(DEFAULT_USER_PROFILE);
      return DEFAULT_USER_PROFILE;
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_USER_PROFILE, ...parsed };
  } catch (err) {
    console.error('Failed to parse user profile from localStorage, using default:', err);
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('user_profile_updated', { detail: profile }));
  } catch (err) {
    console.error('Failed to save user profile to localStorage:', err);
  }
}
