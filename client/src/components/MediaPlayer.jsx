import { useEffect, useMemo, useRef, useState } from "react";
import {
  Captions,
  CaptionsOff,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FolderOpen,
  GripVertical,
  ListMusic,
  Maximize2,
  Minimize2,
  Minus,
  MoreVertical,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  UploadCloud,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { fileUrl, listSubtitles } from "../utils/api";
import { FileTypeIcon, iconTone } from "../utils/fileIcons.jsx";
import { formatBytes } from "../utils/format";
import { saveLastPlayedVideo } from "../utils/mediaMemory";

const QUEUE_KEY = "pocketlan-player-queue";
const VOLUME_KEY = "pocketlan-player-volume";
const MUTED_KEY = "pocketlan-player-muted";
const AUTOPLAY_KEY = "pocketlan-player-autoplay-next";
const REPEAT_KEY = "pocketlan-player-repeat";
const SHUFFLE_KEY = "pocketlan-player-shuffle";
const SUBTITLE_STYLE_KEY = "pocketlan-player-subtitle-style";
const MEDIA_EXTENSIONS = /\.(mp4|webm|ogg|ogv|mov|m4v|mkv|mp3|wav|m4a|flac|aac)$/i;
const SUBTITLE_EXTENSIONS = /\.(vtt|srt)$/i;
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const DEFAULT_SUBTITLE_STYLE = {
  fontSize: 115,
  color: "#ffffff",
  background: "#000000",
  backgroundOpacity: 80,
  position: 82,
  shadow: true
};

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
    // Browser storage can be unavailable in private or embedded sessions.
  }
}

function readNumber(key, fallback, min = 0, max = 1) {
  const stored = window.localStorage.getItem(key);
  if (stored === null) return fallback;

  const value = Number(stored);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readBool(key, fallback) {
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "true";
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeHexColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}

function alphaHex(percent) {
  const value = Math.round((clampNumber(percent, DEFAULT_SUBTITLE_STYLE.backgroundOpacity, 0, 100) / 100) * 255);
  return value.toString(16).padStart(2, "0");
}

function subtitleBackgroundValue(color, opacity) {
  return `${normalizeHexColor(color, DEFAULT_SUBTITLE_STYLE.background)}${alphaHex(opacity)}`;
}

function isMediaItem(item) {
  return item?.type === "file" && ["audio", "video"].includes(item.category);
}

function mediaCategoryFromFile(file) {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "webm", "ogg", "ogv", "mov", "m4v", "mkv"].includes(extension)) return "video";
  return "audio";
}

function isSupportedMediaFile(file) {
  return file.type.startsWith("audio/") || file.type.startsWith("video/") || MEDIA_EXTENSIONS.test(file.name);
}

function isSubtitleFile(file) {
  return file.type === "text/vtt" || SUBTITLE_EXTENSIONS.test(file.name);
}

function queueKey(item) {
  return item?.source === "server" ? `server:${item.path}` : item?.id;
}

function sameQueueItem(left, right) {
  return queueKey(left) === queueKey(right);
}

function serverQueueItem(item) {
  return {
    id: `server:${item.path}`,
    source: "server",
    path: item.path,
    name: item.name,
    category: item.category,
    mime: item.mime,
    size: item.size,
    modifiedAt: item.modifiedAt,
    src: fileUrl("/media", item.path),
    restorable: true,
    item
  };
}

function storedServerQueueItem(item) {
  if (!item?.path || !item?.name) return null;

  return {
    id: `server:${item.path}`,
    source: "server",
    path: item.path,
    name: item.name,
    category: item.category,
    mime: item.mime,
    size: item.size || 0,
    modifiedAt: item.modifiedAt,
    src: fileUrl("/media", item.path),
    restorable: true,
    item: {
      type: "file",
      path: item.path,
      name: item.name,
      category: item.category,
      mime: item.mime,
      size: item.size || 0,
      modifiedAt: item.modifiedAt,
      canPreview: true
    }
  };
}

function mergeQueueItems(...groups) {
  const seen = new Set();
  const merged = [];

  for (const group of groups) {
    for (const item of group || []) {
      const key = queueKey(item);
      if (!key || seen.has(key)) continue;

      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}

function randomId(prefix) {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${id}`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function positionKey(item) {
  if (!item) return "";
  if (item.source === "server") return `pocketlan-player-position:server:${item.path}`;
  return `pocketlan-player-position:local:${item.name}:${item.size}:${item.lastModified}`;
}

function readPosition(item) {
  const key = positionKey(item);
  if (!key) return 0;
  return readNumber(key, 0, 0, Number.MAX_SAFE_INTEGER);
}

function writePosition(item, position) {
  const key = positionKey(item);
  if (!key || !Number.isFinite(position)) return;

  try {
    window.localStorage.setItem(key, String(position));
  } catch {
    // Ignore position persistence failures.
  }
}

function clearPosition(item) {
  const key = positionKey(item);
  if (!key) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore position persistence failures.
  }
}

function ensureVtt(text) {
  const normalized = text.replace(/\r/g, "");
  return normalized.trimStart().startsWith("WEBVTT") ? normalized : `WEBVTT\n\n${normalized}`;
}

function convertSrtToVtt(text) {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/^\s*\d+\s*\n(?=\d{1,2}:\d{2}:\d{2},\d{3})/gm, "")
    .replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
    .trim();

  return `WEBVTT\n\n${normalized}\n`;
}

function parseTimestamp(timestamp) {
  const clean = timestamp.replace(",", ".");
  const parts = clean.split(":");
  const secondsPart = parts.pop() || "0";
  const [seconds, millis = "0"] = secondsPart.split(".");
  const minutes = Number(parts.pop() || 0);
  const hours = Number(parts.pop() || 0);

  return hours * 3600 + minutes * 60 + Number(seconds || 0) + Number(`0.${millis.padEnd(3, "0").slice(0, 3)}`);
}

function parseSubtitleCues(rawVtt, delay = 0) {
  const offset = Number(delay) || 0;
  return String(rawVtt || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex === -1) return null;

      const [startRaw, endRaw] = lines[timingIndex].split("-->").map((part) => part.trim().split(/\s+/)[0]);
      const start = parseTimestamp(startRaw) + offset;
      const end = parseTimestamp(endRaw) + offset;
      const text = lines
        .slice(timingIndex + 1)
        .join("\n")
        .replace(/<[^>]+>/g, "")
        .trim();

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return null;
      return { start: Math.max(0, start), end: Math.max(0, end), text };
    })
    .filter(Boolean);
}

function readSubtitleStyle() {
  const stored = readJson(SUBTITLE_STYLE_KEY, {});
  return {
    fontSize: clampNumber(stored.fontSize, DEFAULT_SUBTITLE_STYLE.fontSize, 75, 180),
    color: normalizeHexColor(stored.color, DEFAULT_SUBTITLE_STYLE.color),
    background: normalizeHexColor(stored.background, DEFAULT_SUBTITLE_STYLE.background),
    backgroundOpacity: clampNumber(stored.backgroundOpacity, DEFAULT_SUBTITLE_STYLE.backgroundOpacity, 0, 100),
    position: clampNumber(stored.position, DEFAULT_SUBTITLE_STYLE.position, 45, 96),
    shadow: stored.shadow !== false
  };
}

function repeatLabel(mode) {
  if (mode === "one") return "Repeat one";
  if (mode === "queue") return "Repeat queue";
  return "Repeat off";
}

function subtitleShadowValue(enabled) {
  return enabled
    ? "0 1px 2px rgba(0,0,0,0.95), 0 0 7px rgba(0,0,0,0.9)"
    : "none";
}

export default function MediaPlayer({ initialItem, mediaItems = [], onDownload }) {
  const containerRef = useRef(null);
  const mediaRef = useRef(null);
  const fileInputRef = useRef(null);
  const subtitleInputRef = useRef(null);
  const objectUrlsRef = useRef(new Map());
  const playOnLoadRef = useRef(false);
  const lastPositionWriteRef = useRef(0);
  const lastMemoryWriteRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const lastInitialPathRef = useRef("");
  const draggedIndexRef = useRef(null);

  const subtitleStyle = useMemo(readSubtitleStyle, []);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [volume, setVolume] = useState(() => {
    const storedVolume = readNumber(VOLUME_KEY, 1);
    return storedVolume > 0 ? storedVolume : 1;
  });
  const [muted, setMuted] = useState(() => readBool(MUTED_KEY, false));
  const [playbackRate, setPlaybackRate] = useState(1);
  const [autoPlayNext, setAutoPlayNext] = useState(() => readBool(AUTOPLAY_KEY, true));
  const [repeatMode, setRepeatMode] = useState(() => window.localStorage.getItem(REPEAT_KEY) || "off");
  const [shuffle, setShuffle] = useState(() => readBool(SHUFFLE_KEY, false));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [queueOpen, setQueueOpen] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [activeSubtitleId, setActiveSubtitleId] = useState("");
  const [subtitleDelay, setSubtitleDelay] = useState(0);
  const [subtitleFontSize, setSubtitleFontSize] = useState(subtitleStyle.fontSize);
  const [subtitleColor, setSubtitleColor] = useState(subtitleStyle.color);
  const [subtitleBackground, setSubtitleBackground] = useState(subtitleStyle.background);
  const [subtitleBackgroundOpacity, setSubtitleBackgroundOpacity] = useState(subtitleStyle.backgroundOpacity);
  const [subtitlePosition, setSubtitlePosition] = useState(subtitleStyle.position);
  const [subtitleShadow, setSubtitleShadow] = useState(subtitleStyle.shadow);
  const [subtitleError, setSubtitleError] = useState("");

  const currentItem = queue[currentIndex] || null;
  const isVideo = currentItem?.category === "video" || currentItem?.mime?.startsWith("video/");
  const activeSubtitle = subtitleTracks.find((track) => track.id === activeSubtitleId) || null;
  const seekMax = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const activeSubtitleCues = useMemo(
    () => (activeSubtitle ? parseSubtitleCues(activeSubtitle.raw, subtitleDelay) : []),
    [activeSubtitle?.id, activeSubtitle?.raw, subtitleDelay]
  );
  const activeSubtitleText =
    subtitlesEnabled && activeSubtitle
      ? activeSubtitleCues.find((cue) => currentTime >= cue.start && currentTime <= cue.end)?.text || ""
      : "";

  function makeSubtitleTrack({ id, label, raw, source = "local", path }) {
    return {
      id,
      label,
      raw,
      source,
      path
    };
  }

  function revealControls() {
    setControlsVisible(true);
  }

  function changeSubtitleDelay(nextDelay) {
    setSubtitleDelay(Number(clampNumber(nextDelay, 0, -30, 30).toFixed(2)));
  }

  function changeSubtitlePosition(nextPosition) {
    setSubtitlePosition(Number(clampNumber(nextPosition, DEFAULT_SUBTITLE_STYLE.position, 45, 96).toFixed(0)));
  }

  function resetSubtitleStyle() {
    setSubtitleDelay(0);
    setSubtitleFontSize(DEFAULT_SUBTITLE_STYLE.fontSize);
    setSubtitleColor(DEFAULT_SUBTITLE_STYLE.color);
    setSubtitleBackground(DEFAULT_SUBTITLE_STYLE.background);
    setSubtitleBackgroundOpacity(DEFAULT_SUBTITLE_STYLE.backgroundOpacity);
    setSubtitlePosition(DEFAULT_SUBTITLE_STYLE.position);
    setSubtitleShadow(DEFAULT_SUBTITLE_STYLE.shadow);
  }

  useEffect(() => {
    if (!isMediaItem(initialItem) || lastInitialPathRef.current === initialItem.path) return;

    lastInitialPathRef.current = initialItem.path;

    const visibleQueue = mediaItems.filter(isMediaItem).map(serverQueueItem);
    const restoredQueue = readJson(QUEUE_KEY, [])
      .map(storedServerQueueItem)
      .filter(Boolean);
    const current = serverQueueItem(initialItem);
    const baseQueue = restoredQueue.length ? mergeQueueItems(restoredQueue, visibleQueue) : visibleQueue;
    const nextQueue = mergeQueueItems(baseQueue, [current]);
    const nextIndex = Math.max(0, nextQueue.findIndex((item) => sameQueueItem(item, current)));

    setQueue(nextQueue);
    setCurrentIndex(nextIndex);
    setError("");
  }, [initialItem, mediaItems]);

  useEffect(() => {
    const restorableQueue = queue
      .filter((item) => item.source === "server")
      .map(({ path, name, category, mime, size, modifiedAt }) => ({ path, name, category, mime, size, modifiedAt }));
    writeJson(QUEUE_KEY, restorableQueue);
  }, [queue]);

  useEffect(() => {
    window.localStorage.setItem(VOLUME_KEY, String(volume));
    window.localStorage.setItem(MUTED_KEY, String(muted));
  }, [muted, volume]);

  useEffect(() => {
    window.localStorage.setItem(AUTOPLAY_KEY, String(autoPlayNext));
    window.localStorage.setItem(REPEAT_KEY, repeatMode);
    window.localStorage.setItem(SHUFFLE_KEY, String(shuffle));
  }, [autoPlayNext, repeatMode, shuffle]);

  useEffect(() => {
    writeJson(SUBTITLE_STYLE_KEY, {
      fontSize: subtitleFontSize,
      color: subtitleColor,
      background: subtitleBackground,
      backgroundOpacity: subtitleBackgroundOpacity,
      position: subtitlePosition,
      shadow: subtitleShadow
    });
  }, [subtitleBackground, subtitleBackgroundOpacity, subtitleColor, subtitleFontSize, subtitlePosition, subtitleShadow]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    media.defaultMuted = false;
    media.volume = muted ? 0 : volume;
    media.muted = muted;
    media.playbackRate = playbackRate;
  }, [currentItem, muted, playbackRate, volume]);

  useEffect(() => {
    let cancelled = false;

    async function loadSiblingSubtitles() {
      setSubtitleError("");
      setActiveSubtitleId("");
      setSubtitlesEnabled(true);

      setSubtitleTracks([]);

      if (!currentItem || currentItem.source !== "server" || currentItem.category !== "video") return;

      try {
        const { tracks = [] } = await listSubtitles(currentItem.path);
        const loadedTracks = [];
        let failedLoads = 0;

        for (const track of tracks.slice(0, 12)) {
          const response = await fetch(fileUrl("/preview", track.path));
          if (!response.ok) {
            failedLoads += 1;
            continue;
          }

          const text = await response.text();
          const raw = track.extension === "srt" ? convertSrtToVtt(text) : ensureVtt(text);
          loadedTracks.push(
            makeSubtitleTrack({
              id: `server-subtitle:${track.path}`,
              label: track.name,
              raw,
              source: "server",
              path: track.path
            })
          );
        }

        if (cancelled) {
          return;
        }

        setSubtitleTracks(loadedTracks);
        if (loadedTracks.length) {
          setActiveSubtitleId(loadedTracks[0].id);
          setSubtitlesEnabled(true);
          setSubtitleError(failedLoads ? `${failedLoads} subtitle file${failedLoads === 1 ? "" : "s"} could not be loaded.` : "");
        } else if (tracks.length) {
          setSubtitleError("Subtitle files were found but could not be loaded.");
        }
      } catch {
        if (!cancelled) setSubtitleError("Subtitle files in this folder could not be loaded.");
      }
    }

    loadSiblingSubtitles();

    return () => {
      cancelled = true;
    };
  }, [currentItem?.id]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const fullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(fullscreen);
      setSettingsOpen(false);
      setControlsVisible(true);
      if (fullscreen) setQueueOpen(false);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen || !isPlaying || settingsOpen || !controlsVisible) return undefined;

    const timer = window.setTimeout(() => setControlsVisible(false), 2200);
    return () => window.clearTimeout(timer);
  }, [controlsVisible, isFullscreen, isPlaying, settingsOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const targetName = event.target?.tagName?.toLowerCase();
      if (["input", "select", "textarea"].includes(targetName) || !currentItem) return;

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlayback();
          break;
        case "arrowleft":
        case "j":
          event.preventDefault();
          seekBy(-10);
          break;
        case "arrowright":
        case "l":
          event.preventDefault();
          seekBy(10);
          break;
        case "arrowup":
          event.preventDefault();
          changeVolume(Math.min(1, volume + 0.05));
          break;
        case "arrowdown":
          event.preventDefault();
          changeVolume(Math.max(0, volume - 0.05));
          break;
        case "m":
          event.preventDefault();
          toggleMute();
          break;
        case "f":
          event.preventDefault();
          toggleFullscreen();
          break;
        case "p":
          event.preventDefault();
          togglePictureInPicture();
          break;
        case "c":
          event.preventDefault();
          setSubtitlesEnabled((current) => !current);
          break;
        case "q":
          event.preventDefault();
          setQueueOpen((current) => !current);
          break;
        case "n":
          event.preventDefault();
          playNext(true);
          break;
        case "b":
          event.preventDefault();
          playPrevious(true);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentItem, isVideo, muted, queue.length, volume]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function updateMediaVolume(nextVolume) {
    const media = mediaRef.current;
    if (media) media.volume = nextVolume;
  }

  function changeVolume(nextVolume) {
    const clamped = Math.min(1, Math.max(0, Number(nextVolume)));
    setVolume(clamped);
    updateMediaVolume(clamped);
    if (clamped > 0) setMuted(false);
  }

  function toggleMute() {
    const shouldUnmute = muted || volume <= 0;
    if (shouldUnmute && volume <= 0) {
      setVolume(1);
      updateMediaVolume(1);
    }

    const nextMuted = !shouldUnmute;
    setMuted(nextMuted);
    if (mediaRef.current) mediaRef.current.muted = nextMuted;
  }

  async function playMedia() {
    const media = mediaRef.current;
    if (!media) return;

    try {
      media.defaultMuted = false;
      media.muted = muted;
      media.volume = muted ? 0 : volume;
      await media.play();
      setError("");
    } catch {
      setError("Playback could not start. Try another file or use download.");
    }
  }

  function pauseMedia() {
    mediaRef.current?.pause();
  }

  function togglePlayback() {
    const media = mediaRef.current;
    if (!media) return;

    if (media.paused) playMedia();
    else pauseMedia();
  }

  function seekTo(nextTime) {
    const media = mediaRef.current;
    if (!media || !Number.isFinite(nextTime)) return;

    const clamped = Math.min(seekMax || nextTime, Math.max(0, nextTime));
    media.currentTime = clamped;
    setCurrentTime(clamped);
  }

  function seekBy(amount) {
    const media = mediaRef.current;
    if (!media) return;
    seekTo((media.currentTime || 0) + amount);
  }

  function getNextIndex(direction = 1) {
    if (!queue.length) return -1;

    if (shuffle && direction > 0 && queue.length > 1) {
      let next = currentIndex;
      while (next === currentIndex) {
        next = Math.floor(Math.random() * queue.length);
      }
      return next;
    }

    const next = currentIndex + direction;
    if (next >= 0 && next < queue.length) return next;
    if (repeatMode === "queue") return direction > 0 ? 0 : queue.length - 1;
    return -1;
  }

  function playQueueIndex(index, autoplay = true) {
    if (index < 0 || index >= queue.length) return;

    if (index === currentIndex) {
      seekTo(0);
      if (autoplay) playMedia();
      return;
    }

    playOnNextLoad(autoplay);
    setCurrentIndex(index);
    setCurrentTime(0);
    setDuration(0);
    setError("");
  }

  function playOnNextLoad(autoplay) {
    playOnLoadRef.current = autoplay;
    lastUiUpdateRef.current = 0;
    lastPositionWriteRef.current = 0;
    lastMemoryWriteRef.current = 0;
    mediaRef.current?.pause();
  }

  function playNext(autoplay = true) {
    const next = getNextIndex(1);
    if (next !== -1) playQueueIndex(next, autoplay);
  }

  function playPrevious(autoplay = true) {
    const media = mediaRef.current;
    if (media && media.currentTime > 3) {
      seekTo(0);
      return;
    }

    const previous = getNextIndex(-1);
    if (previous !== -1) playQueueIndex(previous, autoplay);
  }

  function cycleRepeatMode() {
    setRepeatMode((current) => {
      if (current === "off") return "one";
      if (current === "one") return "queue";
      return "off";
    });
  }

  async function toggleFullscreen() {
    revealControls();

    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setError("Fullscreen is not available in this browser.");
    }
  }

  async function togglePictureInPicture() {
    const media = mediaRef.current;
    if (!isVideo || !media) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && media.requestPictureInPicture) {
        await media.requestPictureInPicture();
      }
    } catch {
      setError("Picture-in-picture is not available for this file.");
    }
  }

  function handleLoadedMetadata() {
    const media = mediaRef.current;
    if (!media) return;

    const mediaDuration = Number.isFinite(media.duration) ? media.duration : 0;
    const savedPosition = readPosition(currentItem);
    const nextPosition = savedPosition > 3 && mediaDuration && savedPosition < mediaDuration - 3 ? savedPosition : media.currentTime || 0;

    media.defaultMuted = false;
    media.volume = muted ? 0 : volume;
    media.muted = muted;
    media.playbackRate = playbackRate;
    setDuration(mediaDuration);
    setIsLoading(false);
    saveLastPlayedVideo(currentItem, nextPosition, mediaDuration);

    if (nextPosition > 3) {
      media.currentTime = nextPosition;
      setCurrentTime(nextPosition);
    } else {
      setCurrentTime(media.currentTime || 0);
    }

    if (playOnLoadRef.current) {
      playOnLoadRef.current = false;
      playMedia();
    }
  }

  function persistCurrentPosition() {
    const media = mediaRef.current;
    if (!media || !currentItem) return;

    const nextTime = media.currentTime || 0;
    const nextDuration = Number.isFinite(media.duration) ? media.duration : duration;
    writePosition(currentItem, nextTime);
    saveLastPlayedVideo(currentItem, nextTime, nextDuration);
  }

  function handleTimeUpdate() {
    const media = mediaRef.current;
    if (!media) return;

    const now = Date.now();
    const nextTime = media.currentTime || 0;

    if (now - lastUiUpdateRef.current > 350) {
      lastUiUpdateRef.current = now;
      setCurrentTime(nextTime);
    }

    if (now - lastPositionWriteRef.current > 2500) {
      lastPositionWriteRef.current = now;
      writePosition(currentItem, nextTime);
    }

    if (now - lastMemoryWriteRef.current > 5000) {
      lastMemoryWriteRef.current = now;
      saveLastPlayedVideo(currentItem, nextTime, Number.isFinite(media.duration) ? media.duration : duration);
    }
  }

  function handleEnded() {
    clearPosition(currentItem);

    if (repeatMode === "one") {
      seekTo(0);
      playMedia();
      return;
    }

    if (!autoPlayNext) {
      setIsPlaying(false);
      return;
    }

    const next = getNextIndex(1);
    if (next !== -1) playQueueIndex(next, true);
    else setIsPlaying(false);
  }

  function handleMediaError() {
    setIsLoading(false);
    setIsPlaying(false);
    setError("This browser cannot play that media format. Download still works for shared files.");
  }

  function createLocalQueueItem(file) {
    const id = randomId("local");
    const src = URL.createObjectURL(file);
    objectUrlsRef.current.set(id, src);

    return {
      id,
      source: "local",
      name: file.name,
      category: mediaCategoryFromFile(file),
      mime: file.type || "application/octet-stream",
      size: file.size,
      lastModified: file.lastModified,
      src,
      restorable: false,
      file
    };
  }

  async function loadSubtitleFile(file) {
    if (!isSubtitleFile(file)) {
      setSubtitleError("Only .vtt and .srt subtitle files are supported.");
      return;
    }

    try {
      const text = await file.text();
      const raw = file.name.toLowerCase().endsWith(".srt") ? convertSrtToVtt(text) : ensureVtt(text);
      const track = makeSubtitleTrack({
        id: randomId("subtitle"),
        label: file.name,
        raw
      });

      setSubtitleTracks((tracks) => [...tracks, track]);
      setActiveSubtitleId(track.id);
      setSubtitlesEnabled(true);
      setSubtitleError("");
    } catch {
      setSubtitleError("Subtitle file could not be loaded.");
    }
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const mediaFiles = [];
    let unsupported = 0;

    for (const file of files) {
      if (isSubtitleFile(file)) {
        await loadSubtitleFile(file);
      } else if (isSupportedMediaFile(file)) {
        mediaFiles.push(createLocalQueueItem(file));
      } else {
        unsupported += 1;
      }
    }

    if (mediaFiles.length) {
      const shouldStart = currentIndex === -1;
      setQueue((current) => {
        const startIndex = current.length;
        const next = mergeQueueItems(current, mediaFiles);
        if (shouldStart) {
          window.setTimeout(() => {
            setCurrentIndex(startIndex);
            setCurrentTime(0);
            setDuration(0);
          }, 0);
        }
        return next;
      });
    }

    if (unsupported) {
      setError(`${unsupported} file${unsupported === 1 ? "" : "s"} could not be added to the media queue.`);
    }
  }

  function removeQueueItem(index) {
    const removed = queue[index];
    if (!removed) return;

    if (removed.source === "local") {
      const url = objectUrlsRef.current.get(removed.id);
      if (url) URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(removed.id);
    }

    setQueue((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setCurrentIndex((current) => {
      if (queue.length <= 1) return -1;
      if (current === index) return Math.min(index, queue.length - 2);
      if (current > index) return current - 1;
      return current;
    });
  }

  function clearQueue() {
    queue.forEach((item) => {
      if (item.source === "local") {
        const url = objectUrlsRef.current.get(item.id);
        if (url) URL.revokeObjectURL(url);
      }
    });

    objectUrlsRef.current.clear();
    setQueue([]);
    setCurrentIndex(-1);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }

  function moveQueueItem(from, to) {
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;

    setQueue((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

    setCurrentIndex((current) => {
      if (current === from) return to;
      if (from < current && to >= current) return current - 1;
      if (from > current && to <= current) return current + 1;
      return current;
    });
  }

  function handleDrop(event) {
    event.preventDefault();
    revealControls();

    if (event.dataTransfer.files?.length) {
      addFiles(event.dataTransfer.files);
    }
  }

  function handleQueueDrop(event, targetIndex) {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer.files?.length) {
      addFiles(event.dataTransfer.files);
      return;
    }

    const storedIndex = event.dataTransfer.getData("text/pocketlan-queue-index");
    const fromIndex = Number(storedIndex || draggedIndexRef.current);
    if (Number.isFinite(fromIndex)) moveQueueItem(fromIndex, targetIndex);
    draggedIndexRef.current = null;
  }

  function removeSubtitle(id) {
    setSubtitleTracks((tracks) => tracks.filter((subtitle) => subtitle.id !== id));

    if (activeSubtitleId === id) {
      setActiveSubtitleId("");
      setSubtitlesEnabled(false);
    }
  }

  const mediaEvents = {
    onCanPlay: () => setIsLoading(false),
    onEnded: handleEnded,
    onError: handleMediaError,
    onLoadedMetadata: handleLoadedMetadata,
    onLoadStart: () => setIsLoading(true),
    onPause: () => {
      setIsPlaying(false);
      persistCurrentPosition();
    },
    onPlay: () => setIsPlaying(true),
    onPlaying: () => {
      setIsLoading(false);
      setIsPlaying(true);
    },
    onTimeUpdate: handleTimeUpdate,
    onWaiting: () => setIsLoading(true)
  };

  const shellHeight = isFullscreen ? "h-screen max-h-screen" : "h-[min(74vh,780px)] min-h-[380px]";
  const controlsClass = controlsVisible ? "opacity-100" : "pointer-events-none opacity-0";

  return (
    <div
      className={`media-player-shell relative min-h-0 overflow-hidden bg-black ${shellHeight}`}
      onClick={revealControls}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onMouseMove={revealControls}
      ref={containerRef}
    >
      <input
        accept="audio/*,video/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.mp4,.webm,.mov,.m4v,.mkv"
        className="hidden"
        multiple
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />
      <input
        accept=".vtt,.srt,text/vtt"
        className="hidden"
        multiple
        onChange={(event) => {
          Array.from(event.target.files || []).forEach((file) => loadSubtitleFile(file));
          event.target.value = "";
        }}
        ref={subtitleInputRef}
        type="file"
      />

      <div className={`relative h-full min-h-0 ${queueOpen && !isFullscreen ? "lg:grid lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <section className="relative h-full min-w-0 overflow-hidden bg-black">
          {currentItem ? (
            isVideo ? (
              <video
                className="media-element h-full w-full bg-black object-contain"
                controls={false}
                crossOrigin="anonymous"
                key={currentItem.id}
                onDoubleClick={toggleFullscreen}
                onEnterPictureInPicture={() => setIsPip(true)}
                onLeavePictureInPicture={() => setIsPip(false)}
                playsInline
                preload="metadata"
                ref={mediaRef}
                src={currentItem.src}
                style={{
                  "--subtitle-bg": subtitleBackgroundValue(subtitleBackground, subtitleBackgroundOpacity),
                  "--subtitle-color": subtitleColor,
                  "--subtitle-font-size": `${subtitleFontSize}%`,
                  "--subtitle-shadow": subtitleShadowValue(subtitleShadow)
                }}
                {...mediaEvents}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-5 p-6 text-center">
                <div className={`flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br ${iconTone(currentItem.category)}`}>
                  <FileTypeIcon item={currentItem} className="h-12 w-12" />
                </div>
                <div className="max-w-xl">
                  <h3 className="break-words text-xl font-bold text-white">{currentItem.name}</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {currentItem.source === "local" ? "Local file" : formatBytes(currentItem.size)}
                  </p>
                </div>
                <audio key={currentItem.id} preload="metadata" ref={mediaRef} src={currentItem.src} {...mediaEvents} />
              </div>
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.06] text-slate-200">
                <ListMusic className="h-9 w-9" />
              </div>
              <h3 className="text-xl font-bold text-white">No media loaded</h3>
              <button className="primary-button" onClick={() => fileInputRef.current?.click()} type="button">
                <FolderOpen className="h-4 w-4" />
                Open local file
              </button>
            </div>
          )}

          {isVideo && activeSubtitleText ? (
            <div
              className="media-subtitle-overlay pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4 text-center"
              style={{
                bottom: `${Math.max(4, 100 - subtitlePosition)}%`,
                "--subtitle-color": subtitleColor,
                "--subtitle-font-size": `${subtitleFontSize}%`,
                "--subtitle-shadow": subtitleShadowValue(subtitleShadow)
              }}
            >
              <div
                className="max-w-[min(88vw,980px)] whitespace-pre-line rounded-xl px-3 py-1.5 font-semibold"
                style={{ background: subtitleBackgroundValue(subtitleBackground, subtitleBackgroundOpacity) }}
              >
                {activeSubtitleText}
              </div>
            </div>
          ) : null}

          {isLoading && currentItem ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          ) : null}

          <div className={`absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-3 transition-opacity duration-200 ${controlsClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{currentItem?.name || "Media player"}</p>
                {subtitleTracks.length ? (
                  <p className="truncate text-xs text-slate-300">{activeSubtitle ? `Captions: ${activeSubtitle.label}` : `${subtitleTracks.length} subtitle track${subtitleTracks.length === 1 ? "" : "s"}`}</p>
                ) : null}
              </div>
              <button className={`icon-button ${queueOpen ? "accent-selected" : ""}`} onClick={() => setQueueOpen((current) => !current)} title="Show queue" type="button">
                <ListMusic className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-3 pb-3 pt-14 transition-opacity duration-200 ${controlsClass}`}>
            {error ? (
              <div className="mb-3 rounded-2xl border border-rose-300/30 bg-rose-950/85 p-3 text-sm text-rose-100">{error}</div>
            ) : null}
            {subtitleError ? <div className="mb-3 rounded-2xl border border-amber-300/30 bg-amber-950/70 p-3 text-sm text-amber-100">{subtitleError}</div> : null}

            <div className="mb-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-xs font-medium text-slate-200">
              <span>{formatTime(currentTime)}</span>
              <input
                aria-label="Seek"
                className="accent-range h-2 w-full cursor-pointer"
                disabled={!currentItem || !seekMax}
                max={seekMax}
                min="0"
                onChange={(event) => seekTo(Number(event.target.value))}
                step="0.1"
                type="range"
                value={Math.min(currentTime, seekMax)}
              />
              <span>{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button className="icon-button h-10 w-10 border-white/15 bg-black/30" disabled={!queue.length} onClick={() => playPrevious(true)} title="Previous" type="button">
                  <SkipBack className="h-4 w-4" />
                </button>
                <button className="icon-button h-10 w-10 border-white/15 bg-black/30" disabled={!currentItem} onClick={() => seekBy(-10)} title="Rewind 10 seconds" type="button">
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button className="primary-button min-h-11 min-w-11 px-3" disabled={!currentItem} onClick={togglePlayback} title="Play or pause" type="button">
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <button className="icon-button h-10 w-10 border-white/15 bg-black/30" disabled={!currentItem} onClick={() => seekBy(10)} title="Forward 10 seconds" type="button">
                  <RotateCw className="h-4 w-4" />
                </button>
                <button className="icon-button h-10 w-10 border-white/15 bg-black/30" disabled={!queue.length} onClick={() => playNext(true)} title="Next" type="button">
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>

              <div className="relative flex items-center gap-1">
                <button
                  className={`icon-button h-10 w-10 border-white/15 bg-black/30 ${subtitlesEnabled && activeSubtitle ? "accent-selected" : ""}`}
                  disabled={!subtitleTracks.length}
                  onClick={() => setSubtitlesEnabled((current) => !current)}
                  title="Captions"
                  type="button"
                >
                  {subtitlesEnabled && activeSubtitle ? <Captions className="h-4 w-4" /> : <CaptionsOff className="h-4 w-4" />}
                </button>
                <button className="icon-button h-10 w-10 border-white/15 bg-black/30" onClick={toggleMute} title={muted || volume === 0 ? "Unmute" : "Mute"} type="button">
                  {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <button className="icon-button h-10 w-10 border-white/15 bg-black/30" onClick={() => setSettingsOpen((current) => !current)} title="Settings" type="button">
                  <Settings className="h-4 w-4" />
                </button>
                <button className="icon-button h-10 w-10 border-white/15 bg-black/30" onClick={toggleFullscreen} title="Fullscreen" type="button">
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>

                {settingsOpen ? (
                  <div className="absolute bottom-12 right-0 z-40 max-h-[min(70vh,480px)] w-[min(92vw,380px)] overflow-auto rounded-3xl border border-white/10 bg-slate-950/95 p-3 text-sm text-slate-200 shadow-soft backdrop-blur-xl custom-scrollbar">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="font-bold text-white">Player options</h3>
                      <button className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white" onClick={() => setSettingsOpen(false)} type="button">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-semibold text-white">Volume</span>
                          <button className="rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={toggleMute} type="button">
                            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            aria-label="Volume"
                            className="accent-range min-w-0 flex-1"
                            max="1"
                            min="0"
                            onChange={(event) => changeVolume(Number(event.target.value))}
                            step="0.01"
                            type="range"
                            value={muted ? 0 : volume}
                          />
                          <span className="w-11 text-right text-xs text-slate-400">{Math.round((muted ? 0 : volume) * 100)}%</span>
                        </div>
                      </div>

                      <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                        <span className="font-semibold text-white">Speed</span>
                        <select className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 outline-none" onChange={(event) => setPlaybackRate(Number(event.target.value))} value={playbackRate}>
                          {PLAYBACK_SPEEDS.map((speed) => (
                            <option className="bg-slate-900" key={speed} value={speed}>
                              {speed}x
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="font-semibold text-white">Subtitles</span>
                          <div className="flex items-center gap-2">
                            <button className="rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={resetSubtitleStyle} title="Reset subtitle style" type="button">
                              <RotateCcw className="h-4 w-4" />
                            </button>
                            <button
                              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${subtitlesEnabled ? "accent-active" : "bg-white/10 text-slate-300"}`}
                              disabled={!subtitleTracks.length}
                              onClick={() => setSubtitlesEnabled((current) => !current)}
                              type="button"
                            >
                              {subtitlesEnabled ? "On" : "Off"}
                            </button>
                          </div>
                        </div>

                        <select
                          className="mb-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 outline-none"
                          onChange={(event) => {
                            setActiveSubtitleId(event.target.value);
                            setSubtitlesEnabled(Boolean(event.target.value));
                          }}
                          value={activeSubtitleId}
                        >
                          <option className="bg-slate-900" value="">
                            Off
                          </option>
                          {subtitleTracks.map((track) => (
                            <option className="bg-slate-900" key={track.id} value={track.id}>
                              {track.label}
                            </option>
                          ))}
                        </select>
                        {!subtitleTracks.length ? (
                          <p className="mb-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                            No subtitle tracks loaded.
                          </p>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2">
                          <button className="secondary-button min-h-10 justify-center px-3" onClick={() => subtitleInputRef.current?.click()} type="button">
                            <UploadCloud className="h-4 w-4" />
                            Load
                          </button>
                          <button className="secondary-button min-h-10 justify-center px-3" disabled={!activeSubtitleId} onClick={() => removeSubtitle(activeSubtitleId)} type="button">
                            <X className="h-4 w-4" />
                            Remove
                          </button>
                        </div>

                        <label className="mt-3 block">
                          <span className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                            <span>Font size</span>
                            <span>{subtitleFontSize}%</span>
                          </span>
                          <input className="accent-range w-full" max="180" min="75" onChange={(event) => setSubtitleFontSize(Number(event.target.value))} type="range" value={subtitleFontSize} />
                        </label>

                        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                            <span>Position</span>
                            <span>{subtitlePosition}%</span>
                          </div>
                          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                            <button className="icon-button h-9 w-9 rounded-xl" onClick={() => changeSubtitlePosition(subtitlePosition - 4)} title="Move subtitles up" type="button">
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <input className="accent-range w-full" max="96" min="45" onChange={(event) => changeSubtitlePosition(event.target.value)} step="1" type="range" value={subtitlePosition} />
                            <button className="icon-button h-9 w-9 rounded-xl" onClick={() => changeSubtitlePosition(subtitlePosition + 4)} title="Move subtitles down" type="button">
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2">
                            <span className="text-xs text-slate-400">Text</span>
                            <input aria-label="Subtitle color" className="h-7 w-9 bg-transparent" onChange={(event) => setSubtitleColor(event.target.value)} type="color" value={subtitleColor} />
                          </label>
                          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2">
                            <span className="text-xs text-slate-400">Box</span>
                            <input aria-label="Subtitle background" className="h-7 w-9 bg-transparent" onChange={(event) => setSubtitleBackground(event.target.value)} type="color" value={subtitleBackground} />
                          </label>
                        </div>

                        <label className="mt-3 block">
                          <span className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                            <span>Box opacity</span>
                            <span>{subtitleBackgroundOpacity}%</span>
                          </span>
                          <input className="accent-range w-full" max="100" min="0" onChange={(event) => setSubtitleBackgroundOpacity(Number(event.target.value))} step="5" type="range" value={subtitleBackgroundOpacity} />
                        </label>

                        <button
                          className={`mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                            subtitleShadow ? "accent-selected text-slate-100" : "border-white/10 bg-slate-950/50 text-slate-400"
                          }`}
                          onClick={() => setSubtitleShadow((current) => !current)}
                          type="button"
                        >
                          <span className="text-xs font-semibold">Text outline</span>
                          <span className="text-xs">{subtitleShadow ? "On" : "Off"}</span>
                        </button>

                        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                          <span className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                            <span>Delay</span>
                            <span>{subtitleDelay}s</span>
                          </span>
                          <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-2">
                            <button className="icon-button h-9 w-9 rounded-xl" onClick={() => changeSubtitleDelay(subtitleDelay - 0.25)} title="Subtitles earlier" type="button">
                              <Minus className="h-4 w-4" />
                            </button>
                            <button className="icon-button h-9 w-9 rounded-xl" onClick={() => changeSubtitleDelay(0)} title="Reset subtitle delay" type="button">
                              <RotateCcw className="h-4 w-4" />
                            </button>
                            <input className="accent-range min-w-0" max="30" min="-30" onChange={(event) => changeSubtitleDelay(event.target.value)} step="0.25" type="range" value={subtitleDelay} />
                            <div className="flex items-center gap-1">
                              <input className="w-16 bg-transparent text-right text-sm outline-none" max="30" min="-30" onChange={(event) => changeSubtitleDelay(event.target.value)} step="0.25" type="number" value={subtitleDelay} />
                              <span className="text-xs text-slate-500">s</span>
                            </div>
                            <button className="icon-button h-9 w-9 rounded-xl" onClick={() => changeSubtitleDelay(subtitleDelay + 0.25)} title="Subtitles later" type="button">
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button className="secondary-button min-h-10 justify-center px-3" onClick={() => fileInputRef.current?.click()} type="button">
                          <FolderOpen className="h-4 w-4" />
                          Open
                        </button>
                        {currentItem?.source === "server" ? (
                          <button className="secondary-button min-h-10 justify-center px-3" onClick={() => onDownload(currentItem.item)} type="button">
                            <Download className="h-4 w-4" />
                            Download
                          </button>
                        ) : null}
                        <button className={`secondary-button min-h-10 justify-center px-3 ${autoPlayNext ? "accent-selected" : ""}`} onClick={() => setAutoPlayNext((current) => !current)} type="button">
                          <SkipForward className="h-4 w-4" />
                          Auto next
                        </button>
                        <button className={`secondary-button min-h-10 justify-center px-3 ${shuffle ? "accent-selected" : ""}`} onClick={() => setShuffle((current) => !current)} type="button">
                          <Shuffle className="h-4 w-4" />
                          Shuffle
                        </button>
                        <button className={`secondary-button min-h-10 justify-center px-3 ${repeatMode !== "off" ? "accent-selected" : ""}`} onClick={cycleRepeatMode} type="button">
                          {repeatMode === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                          {repeatLabel(repeatMode)}
                        </button>
                        <button className="secondary-button min-h-10 justify-center px-3" disabled={!isVideo} onClick={togglePictureInPicture} type="button">
                          <PictureInPicture2 className={`h-4 w-4 ${isPip ? "accent-text" : ""}`} />
                          PiP
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {queueOpen ? (
          <aside
            className={`z-30 flex h-full min-h-0 flex-col border-white/10 bg-slate-950/95 backdrop-blur-xl ${
              isFullscreen
                ? "absolute bottom-0 right-0 top-0 w-[360px] max-w-[88vw] border-l"
                : "absolute bottom-0 right-0 top-0 w-[340px] max-w-[88vw] border-l lg:static lg:w-auto"
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 p-3">
              <div className="min-w-0">
                <h3 className="font-bold text-white">Queue</h3>
                <p className="text-xs text-slate-500">
                  {queue.length} item{queue.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="icon-button h-9 w-9" onClick={() => fileInputRef.current?.click()} title="Add media files" type="button">
                  <FolderOpen className="h-4 w-4" />
                </button>
                <button className="icon-button h-9 w-9" disabled={!queue.length} onClick={clearQueue} title="Clear queue" type="button">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button className="icon-button h-9 w-9" onClick={() => setQueueOpen(false)} title="Hide queue" type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 custom-scrollbar" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
              {queue.length ? (
                queue.map((item, index) => {
                  const active = index === currentIndex;

                  return (
                    <div
                      className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border p-2 transition ${
                        active ? "accent-selected" : "border-white/10 bg-white/[0.045] hover:bg-white/[0.075]"
                      }`}
                      draggable
                      key={item.id}
                      onDragStart={(event) => {
                        draggedIndexRef.current = index;
                        event.dataTransfer.setData("text/pocketlan-queue-index", String(index));
                      }}
                      onDrop={(event) => handleQueueDrop(event, index)}
                    >
                      <button className="text-slate-500 transition hover:text-white" title="Drag to reorder" type="button">
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <button className="min-w-0 text-left" onClick={() => playQueueIndex(index, true)} type="button">
                        <p className="truncate text-sm font-semibold text-white">
                          {active ? <Check className="mr-1 inline h-3.5 w-3.5 accent-text" /> : null}
                          {item.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {item.source === "local" ? "Local" : "Shared"} / {item.category} / {formatBytes(item.size)}
                        </p>
                      </button>
                      <button className="rounded-xl p-2 text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-100" onClick={() => removeQueueItem(index)} title="Remove from queue" type="button">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/15 p-6 text-center">
                  <MoreVertical className="h-9 w-9 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-300">Drop media files here</p>
                </div>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
