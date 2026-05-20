export const DEFAULT_ACCENT_COLOR = "#22d3ee";
const ACCENT_STORAGE_KEY = "pocketlan-accent-color";
const COLOR_MODE_STORAGE_KEY = "pocketlan-color-mode";

function hexToRgb(hex) {
  const normalized = normalizeAccentColor(hex);
  const value = Number.parseInt(normalized.slice(1), 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function contrastFor({ r, g, b }) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#07111f" : "#ffffff";
}

export function normalizeAccentColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color : DEFAULT_ACCENT_COLOR;
}

export function getStoredAccentColor() {
  try {
    return normalizeAccentColor(window.localStorage.getItem(ACCENT_STORAGE_KEY));
  } catch {
    return DEFAULT_ACCENT_COLOR;
  }
}

export function storeAccentColor(color) {
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, normalizeAccentColor(color));
  } catch {
    // Storage can be unavailable in private or embedded browser modes.
  }
}

export function applyAccentColor(color) {
  const normalized = normalizeAccentColor(color);
  const rgb = hexToRgb(normalized);
  const root = document.documentElement;

  root.style.setProperty("--accent", normalized);
  root.style.setProperty("--accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.style.setProperty("--accent-contrast", contrastFor(rgb));
}

export function normalizeColorMode(mode) {
  return mode === "light" ? "light" : "dark";
}

export function getStoredColorMode() {
  try {
    return normalizeColorMode(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function storeColorMode(mode) {
  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, normalizeColorMode(mode));
  } catch {
    // Storage can be unavailable in private or embedded browser modes.
  }
}

export function applyColorMode(mode) {
  const normalized = normalizeColorMode(mode);
  const root = document.documentElement;
  root.dataset.theme = normalized;
  root.style.colorScheme = normalized;
}
