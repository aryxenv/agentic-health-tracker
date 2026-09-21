import type { ChatMessage, UserProfile } from "../types/health";
import { DEFAULT_PROFILE } from "../types/health";

const PROFILE_STORAGE_KEY = "user_profile";

export const DEFAULT_USER_PROFILE: UserProfile = DEFAULT_PROFILE;

export function getUserProfile(): UserProfile {
  if (typeof window === "undefined") {
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
    console.error(
      "Failed to parse user profile from localStorage, using default:",
      err,
    );
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(
      new CustomEvent("user_profile_updated", { detail: profile }),
    );
  } catch (err) {
    console.error("Failed to save user profile to localStorage:", err);
  }
}

const CHAT_STORAGE_KEY = "health_tracker_chat_messages";

export const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  sender: "health_agent",
  text: "Health Agent initialized. Enter food consumption or physical activity data (e.g., '200g chicken breast and rice' or '30 min brisk walk').",
  timestamp: new Date().toISOString(),
};

export function getStoredChatMessages(): ChatMessage[] {
  if (typeof window === "undefined") {
    return [INITIAL_WELCOME_MESSAGE];
  }

  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [INITIAL_WELCOME_MESSAGE];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [INITIAL_WELCOME_MESSAGE];
  } catch (err) {
    console.error("Failed to load chat messages from localStorage:", err);
    return [INITIAL_WELCOME_MESSAGE];
  }
}

export function saveStoredChatMessages(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch (err) {
    console.error("Failed to save chat messages to localStorage:", err);
  }
}

export function clearStoredChatMessages(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear chat messages from localStorage:", err);
  }
}

const MODEL_STORAGE_KEY = "health_tracker_selected_model";

export function getSelectedModel(): string {
  if (typeof window === "undefined") return "openai/gpt-oss-120b";
  try {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    if (
      stored === "openai/gpt-oss-120b" ||
      stored === "openai/gpt-oss-20b" ||
      stored === "qwen/qwen3.8-27b"
    ) {
      return stored;
    }
    return "openai/gpt-oss-120b";
  } catch (_) {
    return "openai/gpt-oss-120b";
  }
}

export function saveSelectedModel(model: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  } catch (err) {
    console.error("Failed to save selected model to localStorage:", err);
  }
}

