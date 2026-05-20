package com.pocketlan.android;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.webkit.MimeTypeMap;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLConnection;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

final class StorageTree {
    private static final String DIRECTORY_MIME = DocumentsContract.Document.MIME_TYPE_DIR;
    private static final int MAX_WALK_ENTRIES = 7500;
    private static final Set<String> IMAGE_EXTENSIONS = setOf("jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "heic");
    private static final Set<String> VIDEO_EXTENSIONS = setOf("mp4", "webm", "mkv", "mov", "m4v", "3gp");
    private static final Set<String> AUDIO_EXTENSIONS = setOf("mp3", "wav", "ogg", "m4a", "flac", "aac");
    private static final Set<String> TEXT_EXTENSIONS = setOf("txt", "md", "log", "rtf", "srt", "vtt");
    private static final Set<String> CODE_EXTENSIONS = setOf("json", "js", "jsx", "ts", "tsx", "html", "css", "scss", "py", "java", "kt", "xml", "yaml", "yml", "sql", "sh");
    private static final Set<String> ARCHIVE_EXTENSIONS = setOf("zip", "rar", "7z", "tar", "gz", "bz2", "xz");
    private static final Set<String> DOCUMENT_EXTENSIONS = setOf("doc", "docx", "odt", "pages");
    private static final Set<String> SPREADSHEET_EXTENSIONS = setOf("xls", "xlsx", "csv", "ods");
    private static final Set<String> PRESENTATION_EXTENSIONS = setOf("ppt", "pptx", "key", "odp");
    private static final Set<String> PREVIEW_CATEGORIES = setOf("image", "video", "audio", "pdf", "text", "code");

    private final ContentResolver resolver;
    private final Uri treeUri;
    private final String rootDocumentId;
    private final Uri rootDocumentUri;

    StorageTree(Context context, Uri treeUri) {
        this.resolver = context.getContentResolver();
        this.treeUri = treeUri;
        this.rootDocumentId = DocumentsContract.getTreeDocumentId(treeUri);
        this.rootDocumentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, rootDocumentId);
    }

    FolderListing list(String relativePath) throws Exception {
        DocumentNode folder = resolve(relativePath);
        if (!folder.directory) {
            throw new HttpException(400, "Path is not a folder.");
        }

        List<DocumentNode> items = listChildren(folder.documentId, folder.path);
        return new FolderListing(folder, items);
    }

    DocumentNode info(String relativePath, boolean allowRoot) throws Exception {
        DocumentNode node = resolve(relativePath);
        if (!allowRoot && node.path.isEmpty()) {
            throw new HttpException(400, "The shared root cannot be used for this action.");
        }
        return node;
    }

    StorageSummary storageSummary() throws Exception {
        StorageSummary summary = new StorageSummary();
        walkSummary(resolve(""), summary);
        return summary;
    }

    List<DocumentNode> search(String query, int limit) throws Exception {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.US);
        if (normalized.isEmpty()) {
            return Collections.emptyList();
        }

        List<DocumentNode> results = new ArrayList<>();
        walkSearch(resolve(""), normalized, Math.max(1, Math.min(limit, 1000)), results);
        return results;
    }

    List<DocumentNode> subtitleTracks(String mediaPath) throws Exception {
        DocumentNode media = info(mediaPath, false);
        if (media.directory) {
            return Collections.emptyList();
        }

        String mediaBaseName = baseName(media.name).toLowerCase(Locale.US);
        List<DocumentNode> tracks = new ArrayList<>();
        for (DocumentNode child : list(parentPath(media.path)).items) {
            String ext = extension(child.name);
            if (child.directory || (!"srt".equals(ext) && !"vtt".equals(ext))) {
                continue;
            }

            String subtitleBaseName = baseName(child.name).toLowerCase(Locale.US);
            if (subtitleBaseName.equals(mediaBaseName) || subtitleBaseName.startsWith(mediaBaseName + ".")) {
                tracks.add(child);
            }
        }
        return tracks;
    }

    DocumentNode createFolder(String parentPath, String name) throws Exception {
        String safeName = validateName(name);
        DocumentNode parent = info(parentPath, true);
        if (!parent.directory) {
            throw new HttpException(400, "Parent path is not a folder.");
        }
        if (findChild(parent.documentId, safeName, parent.path) != null) {
            throw new HttpException(409, "A file or folder with that name already exists.");
        }

        Uri created = DocumentsContract.createDocument(resolver, parent.uri, DIRECTORY_MIME, safeName);
        if (created == null) {
            throw new HttpException(500, "Android could not create the folder.");
        }
        String path = appendPath(parent.path, safeName);
        return queryDocument(DocumentsContract.getDocumentId(created), path);
    }

    DocumentNode rename(String relativePath, String newName) throws Exception {
        String safeName = validateName(newName);
        DocumentNode node = info(relativePath, false);
        String parentPath = parentPath(node.path);
        DocumentNode parent = info(parentPath, true);
        DocumentNode existing = findChild(parent.documentId, safeName, parent.path);
        if (existing != null && !existing.documentId.equals(node.documentId)) {
            throw new HttpException(409, "A file or folder with that name already exists.");
        }

        Uri renamed = DocumentsContract.renameDocument(resolver, node.uri, safeName);
        if (renamed == null) {
            throw new HttpException(500, "Android could not rename the item.");
        }
        return queryDocument(DocumentsContract.getDocumentId(renamed), appendPath(parent.path, safeName));
    }

    void delete(String relativePath) throws Exception {
        DocumentNode node = info(relativePath, false);
        if (!DocumentsContract.deleteDocument(resolver, node.uri)) {
            throw new HttpException(500, "Android could not delete the item.");
        }
    }

    DocumentNode writeFile(String parentPath, String name, boolean overwrite, InputStream body, long contentLength) throws Exception {
        String safeName = validateName(name);
        DocumentNode parent = info(parentPath, true);
        if (!parent.directory) {
            throw new HttpException(400, "Uploads must target a folder.");
        }

        DocumentNode existing = findChild(parent.documentId, safeName, parent.path);
        if (existing != null) {
            if (!overwrite) {
                throw new HttpException(409, "A file or folder with that name already exists.");
            }
            if (existing.directory) {
                throw new HttpException(409, "A folder with that name already exists.");
            }
            if (!DocumentsContract.deleteDocument(resolver, existing.uri)) {
                throw new HttpException(500, "Android could not replace the existing file.");
            }
        }

        Uri created = DocumentsContract.createDocument(resolver, parent.uri, mimeForName(safeName), safeName);
        if (created == null) {
            throw new HttpException(500, "Android could not create the uploaded file.");
        }

        OutputStream outputStream = resolver.openOutputStream(created, "w");
        if (outputStream == null) {
            throw new HttpException(500, "Android could not open the uploaded file for writing.");
        }

        try {
            IoUtils.copyExactly(body, outputStream, contentLength);
        } finally {
            IoUtils.closeQuietly(outputStream);
        }

        return queryDocument(DocumentsContract.getDocumentId(created), appendPath(parent.path, safeName));
    }

    InputStream openInputStream(DocumentNode node) throws Exception {
        InputStream inputStream = resolver.openInputStream(node.uri);
        if (inputStream == null) {
            throw new HttpException(404, "File stream was not available.");
        }
        return inputStream;
    }

    private void walkSummary(DocumentNode folder, StorageSummary summary) throws Exception {
        if (summary.files + summary.folders > MAX_WALK_ENTRIES) {
            summary.truncated = true;
            return;
        }

        for (DocumentNode child : listChildren(folder.documentId, folder.path)) {
            if (child.directory) {
                summary.folders += 1;
                walkSummary(child, summary);
            } else {
                summary.files += 1;
                summary.size += Math.max(0, child.size);
            }
        }
    }

    private void walkSearch(DocumentNode folder, String query, int limit, List<DocumentNode> results) throws Exception {
        if (results.size() >= limit) {
            return;
        }

        for (DocumentNode child : listChildren(folder.documentId, folder.path)) {
            if (results.size() >= limit) {
                return;
            }
            if (child.name.toLowerCase(Locale.US).contains(query)) {
                results.add(child);
            }
            if (child.directory) {
                walkSearch(child, query, limit, results);
            }
        }
    }

    private DocumentNode resolve(String relativePath) throws Exception {
        String normalized = normalizeRelativePath(relativePath);
        if (normalized.isEmpty()) {
            return queryDocument(rootDocumentId, "");
        }

        String documentId = rootDocumentId;
        String cursorPath = "";
        for (String part : normalized.split("/")) {
            DocumentNode child = findChild(documentId, part, cursorPath);
            if (child == null) {
                throw new HttpException(404, "Path was not found.");
            }
            documentId = child.documentId;
            cursorPath = child.path;
        }

        return queryDocument(documentId, cursorPath);
    }

    private DocumentNode findChild(String parentDocumentId, String name, String parentPath) throws Exception {
        for (DocumentNode child : listChildren(parentDocumentId, parentPath)) {
            if (child.name.equals(name)) {
                return child;
            }
        }
        return null;
    }

    private List<DocumentNode> listChildren(String parentDocumentId, String parentPath) throws Exception {
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocumentId);
        List<DocumentNode> children = new ArrayList<>();
        String[] projection = {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED
        };

        Cursor cursor = resolver.query(childrenUri, projection, null, null, null);
        if (cursor == null) {
            throw new HttpException(404, "Folder contents were not available.");
        }

        try {
            while (cursor.moveToNext()) {
                String documentId = getString(cursor, 0);
                String name = getString(cursor, 1);
                String mime = getString(cursor, 2);
                long size = getLong(cursor, 3);
                long modified = getLong(cursor, 4);
                if (name == null || documentId == null) {
                    continue;
                }
                String path = appendPath(parentPath, name);
                children.add(new DocumentNode(documentId, documentUri(documentId), name, path, DIRECTORY_MIME.equals(mime), mime, size, modified));
            }
        } finally {
            cursor.close();
        }

        children.sort(Comparator
                .comparing((DocumentNode node) -> !node.directory)
                .thenComparing(node -> node.name.toLowerCase(Locale.US)));
        return children;
    }

    private DocumentNode queryDocument(String documentId, String relativePath) throws Exception {
        Uri documentUri = documentUri(documentId);
        String[] projection = {
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED
        };

        Cursor cursor = resolver.query(documentUri, projection, null, null, null);
        if (cursor == null) {
            throw new HttpException(404, "Path was not found.");
        }

        try {
            if (!cursor.moveToFirst()) {
                throw new HttpException(404, "Path was not found.");
            }
            String name = getString(cursor, 0);
            String mime = getString(cursor, 1);
            long size = getLong(cursor, 2);
            long modified = getLong(cursor, 3);
            if (relativePath.isEmpty() && (name == null || name.trim().isEmpty())) {
                name = "Shared folder";
            }
            return new DocumentNode(documentId, documentUri, name == null ? "Item" : name, relativePath, DIRECTORY_MIME.equals(mime), mime, size, modified);
        } finally {
            cursor.close();
        }
    }

    private Uri documentUri(String documentId) {
        if (rootDocumentId.equals(documentId)) {
            return rootDocumentUri;
        }
        return DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId);
    }

    private static String normalizeRelativePath(String input) throws HttpException {
        String raw = input == null ? "" : input.replace("\0", "").trim().replace('\\', '/');
        while (raw.startsWith("/")) {
            raw = raw.substring(1);
        }
        if (raw.isEmpty() || ".".equals(raw)) {
            return "";
        }
        if (raw.matches("^[a-zA-Z]:.*") || raw.startsWith("//")) {
            throw new HttpException(400, "Absolute paths are not allowed.");
        }

        List<String> parts = new ArrayList<>();
        for (String part : raw.split("/")) {
            if (part.isEmpty()) {
                continue;
            }
            if (".".equals(part) || "..".equals(part)) {
                throw new HttpException(400, "Path traversal is not allowed.");
            }
            parts.add(part);
        }
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (builder.length() > 0) {
                builder.append('/');
            }
            builder.append(part);
        }
        return builder.toString();
    }

    private static String validateName(String name) throws HttpException {
        String value = name == null ? "" : name.replace("\0", "").trim();
        if (value.isEmpty()) {
            throw new HttpException(400, "A name is required.");
        }
        if (".".equals(value) || "..".equals(value) || value.contains("/") || value.contains("\\")) {
            throw new HttpException(400, "Names cannot contain path separators or traversal markers.");
        }
        return value;
    }

    private static String appendPath(String parentPath, String name) {
        if (parentPath == null || parentPath.isEmpty()) {
            return name;
        }
        return parentPath + "/" + name;
    }

    private static String parentPath(String path) {
        int slash = path.lastIndexOf('/');
        if (slash <= 0) {
            return "";
        }
        return path.substring(0, slash);
    }

    private static String extension(String name) {
        int dot = name == null ? -1 : name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        return name.substring(dot + 1).toLowerCase(Locale.US);
    }

    private static String baseName(String name) {
        int dot = name == null ? -1 : name.lastIndexOf('.');
        if (dot <= 0) {
            return name == null ? "" : name;
        }
        return name.substring(0, dot);
    }

    private static String categoryFor(String extension, boolean directory) {
        if (directory) return "folder";
        if (IMAGE_EXTENSIONS.contains(extension)) return "image";
        if (VIDEO_EXTENSIONS.contains(extension)) return "video";
        if (AUDIO_EXTENSIONS.contains(extension)) return "audio";
        if ("pdf".equals(extension)) return "pdf";
        if (TEXT_EXTENSIONS.contains(extension)) return "text";
        if (CODE_EXTENSIONS.contains(extension)) return "code";
        if (ARCHIVE_EXTENSIONS.contains(extension)) return "archive";
        if (DOCUMENT_EXTENSIONS.contains(extension)) return "document";
        if (SPREADSHEET_EXTENSIONS.contains(extension)) return "spreadsheet";
        if (PRESENTATION_EXTENSIONS.contains(extension)) return "presentation";
        return "unknown";
    }

    static String mimeForName(String name) {
        String guessed = URLConnection.guessContentTypeFromName(name);
        if (guessed != null) {
            return guessed;
        }
        String extension = extension(name);
        if (!extension.isEmpty()) {
            String type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            if (type != null) {
                return type;
            }
        }
        return "application/octet-stream";
    }

    private static String formatBytes(long bytes) {
        if (bytes <= 0) {
            return "0 B";
        }
        String[] units = {"B", "KB", "MB", "GB", "TB"};
        int index = Math.min((int) (Math.log(bytes) / Math.log(1024)), units.length - 1);
        double value = bytes / Math.pow(1024, index);
        return String.format(Locale.US, value >= 10 || index == 0 ? "%.0f %s" : "%.1f %s", value, units[index]);
    }

    private static String isoDate(long timestamp) {
        if (timestamp <= 0) {
            return "";
        }
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(timestamp));
    }

    private static String getString(Cursor cursor, int index) {
        return cursor.isNull(index) ? null : cursor.getString(index);
    }

    private static long getLong(Cursor cursor, int index) {
        return cursor.isNull(index) ? 0 : cursor.getLong(index);
    }

    private static Set<String> setOf(String... values) {
        Set<String> set = new HashSet<>();
        Collections.addAll(set, values);
        return set;
    }

    static final class FolderListing {
        final DocumentNode folder;
        final List<DocumentNode> items;

        FolderListing(DocumentNode folder, List<DocumentNode> items) {
            this.folder = folder;
            this.items = items;
        }

        JSONObject toJson() throws Exception {
            JSONArray itemArray = new JSONArray();
            for (DocumentNode item : items) {
                itemArray.put(item.toJson());
            }

            JSONObject object = new JSONObject();
            object.put("path", folder.path);
            object.put("name", folder.name);
            object.put("parentPath", folder.path.isEmpty() ? JSONObject.NULL : parentPath(folder.path));
            object.put("breadcrumbs", breadcrumbs(folder.path));
            object.put("items", itemArray);
            return object;
        }

        private static JSONArray breadcrumbs(String path) throws Exception {
            JSONArray crumbs = new JSONArray();
            JSONObject home = new JSONObject();
            home.put("name", "Home");
            home.put("path", "");
            crumbs.put(home);

            String cursor = "";
            if (!path.isEmpty()) {
                for (String part : path.split("/")) {
                    cursor = cursor.isEmpty() ? part : cursor + "/" + part;
                    JSONObject crumb = new JSONObject();
                    crumb.put("name", part);
                    crumb.put("path", cursor);
                    crumbs.put(crumb);
                }
            }
            return crumbs;
        }
    }

    static final class StorageSummary {
        int files;
        int folders;
        long size;
        boolean truncated;

        JSONObject toJson() throws Exception {
            JSONObject object = new JSONObject();
            object.put("files", files);
            object.put("folders", folders);
            object.put("size", size);
            object.put("sizeFormatted", formatBytes(size));
            object.put("truncated", truncated);
            return object;
        }
    }

    static final class DocumentNode {
        final String documentId;
        final Uri uri;
        final String name;
        final String path;
        final boolean directory;
        final String mime;
        final long size;
        final long modified;

        DocumentNode(String documentId, Uri uri, String name, String path, boolean directory, String mime, long size, long modified) {
            this.documentId = documentId;
            this.uri = uri;
            this.name = name;
            this.path = path;
            this.directory = directory;
            this.mime = directory ? DIRECTORY_MIME : (mime == null || mime.isEmpty() ? mimeForName(name) : mime);
            this.size = directory ? 0 : size;
            this.modified = modified;
        }

        JSONObject toJson() throws Exception {
            String ext = extension(name);
            String category = categoryFor(ext, directory);
            JSONObject object = new JSONObject();
            object.put("name", name);
            object.put("path", path);
            object.put("type", directory ? "folder" : "file");
            object.put("extension", ext);
            object.put("mime", mime);
            object.put("size", size);
            object.put("sizeFormatted", directory ? "Folder" : formatBytes(size));
            object.put("modifiedAt", isoDate(modified));
            object.put("category", category);
            object.put("canPreview", PREVIEW_CATEGORIES.contains(category));
            return object;
        }
    }
}
