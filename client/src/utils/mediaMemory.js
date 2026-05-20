export const LAST_PLAYED_VIDEO_EVENT = "pocketlan:last-played-video";

const LAST_PLAYED_VIDEO_KEY = "pocketlan-last-played-video";

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }

  window.dispatchEvent(new CustomEvent(LAST_PLAYED_VIDEO_EVENT));
}

function toRestorableVideo(value) {
  if (!value?.path || !value?.name) return null;

  return {
    ...value,
    item: {
      type: "file",
      path: value.path,
      name: value.name,
      category: "video",
      mime: value.mime || "video/mp4",
      size: value.size || 0,
      modifiedAt: value.modifiedAt,
      canPreview: true
    }
  };
}

export function getLastPlayedVideo() {
  return toRestorableVideo(readJson(LAST_PLAYED_VIDEO_KEY, null));
}

export function saveLastPlayedVideo(item, position = 0, duration = 0) {
  if (!item || item.source !== "server" || item.category !== "video") return;

  writeJson(LAST_PLAYED_VIDEO_KEY, {
    path: item.path,
    name: item.name,
    category: "video",
    mime: item.mime,
    size: item.size || 0,
    modifiedAt: item.modifiedAt,
    position: Number.isFinite(position) ? position : 0,
    duration: Number.isFinite(duration) ? duration : 0,
    playedAt: new Date().toISOString()
  });
}
