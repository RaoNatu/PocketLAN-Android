export function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(value) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function titleCase(value = "") {
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function sortItems(items, sortKey, direction) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...items].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }

    let left = a[sortKey];
    let right = b[sortKey];

    if (sortKey === "name" || sortKey === "category" || sortKey === "extension") {
      left = String(left || "").toLowerCase();
      right = String(right || "").toLowerCase();
      return left.localeCompare(right) * multiplier;
    }

    if (sortKey === "modifiedAt") {
      return (new Date(left).getTime() - new Date(right).getTime()) * multiplier;
    }

    return ((left || 0) - (right || 0)) * multiplier;
  });
}

