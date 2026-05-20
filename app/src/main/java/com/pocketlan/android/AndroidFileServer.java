package com.pocketlan.android;

import android.content.Context;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

final class AndroidFileServer {
    private static final int MAX_HEADER_LINE = 16 * 1024;
    private static final int MAX_JSON_BODY = 1024 * 1024;

    private final Context context;
    private final StorageTree storageTree;
    private final int port;
    private final String pin;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final ExecutorService clients = Executors.newCachedThreadPool();
    private ServerSocket serverSocket;
    private Thread acceptThread;

    AndroidFileServer(Context context, Uri treeUri, int port, String pin) {
        this.context = context.getApplicationContext();
        this.storageTree = new StorageTree(context, treeUri);
        this.port = port;
        this.pin = pin == null ? "" : pin.trim();
    }

    void start() throws IOException {
        if (running.get()) {
            return;
        }

        serverSocket = new ServerSocket(port);
        running.set(true);
        acceptThread = new Thread(this::acceptLoop, "PocketLAN-Accept");
        acceptThread.start();
    }

    void stop() {
        running.set(false);
        if (serverSocket != null) {
            try {
                serverSocket.close();
            } catch (IOException ignored) {
                // Socket close is best effort during shutdown.
            }
        }
        clients.shutdownNow();
    }

    private void acceptLoop() {
        while (running.get()) {
            try {
                Socket socket = serverSocket.accept();
                clients.execute(() -> handleClient(socket));
            } catch (IOException error) {
                if (running.get()) {
                    error.printStackTrace();
                }
            }
        }
    }

    private void handleClient(Socket socket) {
        try (Socket closeableSocket = socket;
             BufferedInputStream input = new BufferedInputStream(closeableSocket.getInputStream());
             BufferedOutputStream output = new BufferedOutputStream(closeableSocket.getOutputStream())) {
            closeableSocket.setSoTimeout(45_000);
            Request request = readRequest(input);
            if (request == null) {
                return;
            }
            route(request, input, output);
            output.flush();
        } catch (Exception error) {
            error.printStackTrace();
        }
    }

    private void route(Request request, InputStream body, OutputStream output) throws Exception {
        try {
            if ("OPTIONS".equals(request.method)) {
                sendBytes(request, output, 204, "No Content", "text/plain", new byte[0], null);
                return;
            }

            if (serveStatic(request, output)) {
                return;
            }

            if ("/api/auth/status".equals(request.path)) {
                requireMethod(request, "GET");
                sendAuthStatus(request, output);
                return;
            }

            if ("/api/auth/verify".equals(request.path)) {
                requireMethod(request, "POST");
                verifyPin(request, body, output);
                return;
            }

            if (!isAuthorized(request)) {
                JSONObject object = new JSONObject();
                object.put("error", pin.isEmpty() ? "Unauthorized" : "PIN required");
                sendJson(request, output, 401, object);
                return;
            }

            switch (request.path) {
                case "/api/files":
                    requireMethod(request, "GET");
                    sendJson(request, output, 200, storageTree.list(request.query("path")).toJson());
                    return;
                case "/api/storage":
                    requireMethod(request, "GET");
                    sendJson(request, output, 200, storageTree.storageSummary().toJson());
                    return;
                case "/api/search":
                    requireMethod(request, "GET");
                    sendSearch(request, output);
                    return;
                case "/api/info":
                    requireMethod(request, "GET");
                    sendJson(request, output, 200, storageTree.info(request.query("path"), false).toJson());
                    return;
                case "/api/download":
                    requireMethod(request, "GET", "HEAD");
                    sendDocument(request, output, request.query("path"), true);
                    return;
                case "/api/preview":
                case "/api/media":
                    requireMethod(request, "GET", "HEAD");
                    sendDocument(request, output, request.query("path"), false);
                    return;
                case "/api/subtitles":
                    requireMethod(request, "GET");
                    sendSubtitles(request, output);
                    return;
                case "/api/folder":
                    requireMethod(request, "POST");
                    createFolder(request, body, output);
                    return;
                case "/api/rename":
                    requireMethod(request, "PATCH", "POST");
                    rename(request, body, output);
                    return;
                case "/api/delete":
                    requireMethod(request, "DELETE", "POST");
                    delete(request, body, output);
                    return;
                case "/api/upload":
                    requireMethod(request, "PUT", "POST");
                    upload(request, body, output);
                    return;
                case "/api/bulk-download":
                    requireMethod(request, "POST");
                    sendBulkDownload(request, body, output);
                    return;
                default:
                    throw new HttpException(404, "Route was not found.");
            }
        } catch (HttpException error) {
            JSONObject object = new JSONObject();
            object.put("error", error.getMessage());
            sendJson(request, output, error.status, object);
        } catch (Exception error) {
            JSONObject object = new JSONObject();
            object.put("error", error.getMessage() == null ? "Unexpected server error." : error.getMessage());
            sendJson(request, output, 500, object);
        }
    }

    private boolean serveStatic(Request request, OutputStream output) throws Exception {
        if (request.path.startsWith("/api/")) {
            return false;
        }
        requireMethod(request, "GET", "HEAD");

        String assetPath = staticAssetPath(request.path);
        if (assetPath == null) {
            sendBytes(request, output, 404, "Not Found", "text/plain; charset=utf-8", "Not found".getBytes(StandardCharsets.UTF_8), null);
            return true;
        }

        InputStream asset;
        String responsePath = assetPath;
        try {
            asset = context.getAssets().open(assetPath);
        } catch (IOException missing) {
            if (!shouldServeIndexFallback(request.path)) {
                sendBytes(request, output, 404, "Not Found", "text/plain; charset=utf-8", "Not found".getBytes(StandardCharsets.UTF_8), null);
                return true;
            }
            responsePath = "index.html";
            asset = context.getAssets().open(responsePath);
        }

        byte[] bytes;
        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            IoUtils.copy(asset, buffer);
            bytes = buffer.toByteArray();
        } finally {
            IoUtils.closeQuietly(asset);
        }

        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        sendBytes(request, output, 200, "OK", contentTypeForAsset(responsePath), bytes, headers);
        return true;
    }

    private void sendAuthStatus(Request request, OutputStream output) throws Exception {
        JSONObject object = new JSONObject();
        object.put("pinEnabled", !pin.isEmpty());
        sendJson(request, output, 200, object);
    }

    private void verifyPin(Request request, InputStream body, OutputStream output) throws Exception {
        JSONObject payload = readJson(request, body);
        if (!pin.isEmpty() && !pin.equals(payload.optString("pin", ""))) {
            throw new HttpException(401, "Invalid PIN.");
        }

        JSONObject object = new JSONObject();
        object.put("ok", true);
        sendJson(request, output, 200, object);
    }

    private void sendSearch(Request request, OutputStream output) throws Exception {
        int limit = 250;
        try {
            limit = Integer.parseInt(request.query("limit"));
        } catch (Exception ignored) {
            // Default limit is good enough for the browser UI.
        }

        JSONArray results = new JSONArray();
        for (StorageTree.DocumentNode node : storageTree.search(request.query("q"), limit)) {
            results.put(node.toJson());
        }

        JSONObject object = new JSONObject();
        object.put("query", request.query("q"));
        object.put("results", results);
        sendJson(request, output, 200, object);
    }

    private void sendSubtitles(Request request, OutputStream output) throws Exception {
        JSONArray tracks = new JSONArray();
        for (StorageTree.DocumentNode node : storageTree.subtitleTracks(request.query("path"))) {
            tracks.put(node.toJson());
        }

        JSONObject object = new JSONObject();
        object.put("tracks", tracks);
        sendJson(request, output, 200, object);
    }

    private void createFolder(Request request, InputStream body, OutputStream output) throws Exception {
        JSONObject payload = readJson(request, body);
        StorageTree.DocumentNode node = storageTree.createFolder(payload.optString("path", ""), payload.optString("name", ""));
        sendJson(request, output, 201, node.toJson());
    }

    private void rename(Request request, InputStream body, OutputStream output) throws Exception {
        JSONObject payload = readJson(request, body);
        StorageTree.DocumentNode node = storageTree.rename(payload.optString("path", ""), payload.optString("newName", ""));
        sendJson(request, output, 200, node.toJson());
    }

    private void delete(Request request, InputStream body, OutputStream output) throws Exception {
        JSONObject payload = readJson(request, body);
        storageTree.delete(payload.optString("path", ""));
        JSONObject object = new JSONObject();
        object.put("ok", true);
        sendJson(request, output, 200, object);
    }

    private void upload(Request request, InputStream body, OutputStream output) throws Exception {
        String name = request.query("name");
        String path = request.query("path");
        boolean overwrite = "true".equalsIgnoreCase(request.query("overwrite"));
        long contentLength = request.contentLength();
        if (contentLength < 0) {
            throw new HttpException(411, "Uploads require a Content-Length header.");
        }
        StorageTree.DocumentNode node = storageTree.writeFile(path, name, overwrite, body, contentLength);
        sendJson(request, output, 201, node.toJson());
    }

    private void sendBulkDownload(Request request, InputStream body, OutputStream output) throws Exception {
        JSONObject payload = readJson(request, body);
        JSONArray paths = payload.optJSONArray("paths");
        if (paths == null || paths.length() == 0) {
            throw new HttpException(400, "No files or folders were selected.");
        }

        List<StorageTree.DocumentNode> nodes = new ArrayList<>();
        for (int index = 0; index < paths.length(); index += 1) {
            nodes.add(storageTree.info(paths.optString(index), false));
        }

        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Disposition", "attachment; filename=\"pocketlan-download.zip\"");
        writeHeaders(output, 200, "OK", "application/zip", headers);

        ZipOutputStream zip = new ZipOutputStream(output);
        Set<String> usedEntries = new HashSet<>();
        for (StorageTree.DocumentNode node : nodes) {
            addNodeToZip(node, safeZipSegment(node.name), zip, usedEntries);
        }
        zip.finish();
    }

    private void sendDocument(Request request, OutputStream output, String path, boolean attachment) throws Exception {
        StorageTree.DocumentNode node = storageTree.info(path, false);
        if (node.directory) {
            throw new HttpException(400, "This action requires a file.");
        }

        long size = Math.max(0, node.size);
        Range range = parseRange(request.header("range"), size);
        int status = range.partial ? 206 : 200;
        String disposition = (attachment ? "attachment" : "inline") + "; filename=\"" + safeHeaderValue(node.name) + "\"";

        Map<String, String> headers = new HashMap<>();
        headers.put("Accept-Ranges", "bytes");
        headers.put("Content-Disposition", disposition);
        headers.put("Content-Length", String.valueOf(range.length()));
        if (range.partial) {
            headers.put("Content-Range", "bytes " + range.start + "-" + range.end + "/" + size);
        }

        writeHeaders(output, status, statusText(status), node.mime, headers);
        if (request.headOnly()) {
            return;
        }

        InputStream inputStream = storageTree.openInputStream(node);
        try {
            IoUtils.skipFully(inputStream, range.start);
            IoUtils.copyExactly(inputStream, output, range.length());
        } finally {
            IoUtils.closeQuietly(inputStream);
        }
    }

    private void addNodeToZip(StorageTree.DocumentNode node, String entryPath, ZipOutputStream zip, Set<String> usedEntries) throws Exception {
        if (node.directory) {
            String directoryEntry = uniqueZipEntryName(entryPath + "/", usedEntries);
            zip.putNextEntry(new ZipEntry(directoryEntry));
            zip.closeEntry();

            String childPrefix = directoryEntry.substring(0, directoryEntry.length() - 1);
            for (StorageTree.DocumentNode child : storageTree.list(node.path).items) {
                addNodeToZip(child, childPrefix + "/" + safeZipSegment(child.name), zip, usedEntries);
            }
            return;
        }

        String fileEntry = uniqueZipEntryName(entryPath, usedEntries);
        zip.putNextEntry(new ZipEntry(fileEntry));
        InputStream inputStream = storageTree.openInputStream(node);
        try {
            IoUtils.copy(inputStream, zip);
        } finally {
            IoUtils.closeQuietly(inputStream);
            zip.closeEntry();
        }
    }

    private JSONObject readJson(Request request, InputStream body) throws Exception {
        long contentLength = request.contentLength();
        if (contentLength < 0) {
            return new JSONObject();
        }
        if (contentLength > MAX_JSON_BODY) {
            throw new HttpException(413, "Request body is too large.");
        }

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        IoUtils.copyExactly(body, buffer, contentLength);
        String text = buffer.toString(StandardCharsets.UTF_8.name()).trim();
        if (text.isEmpty()) {
            return new JSONObject();
        }
        return new JSONObject(text);
    }

    private boolean isAuthorized(Request request) {
        if (pin.isEmpty()) {
            return true;
        }
        String provided = request.header("x-pocketlan-pin");
        if (provided == null || provided.isEmpty()) {
            provided = request.query("pin");
        }
        return pin.equals(provided);
    }

    private static void requireMethod(Request request, String... methods) throws HttpException {
        for (String method : methods) {
            if (method.equals(request.method)) {
                return;
            }
        }
        throw new HttpException(405, "Method is not allowed.");
    }

    private static Request readRequest(InputStream input) throws IOException, HttpException {
        String requestLine = readLine(input);
        if (requestLine == null || requestLine.trim().isEmpty()) {
            return null;
        }

        String[] parts = requestLine.split(" ");
        if (parts.length < 2) {
            throw new HttpException(400, "Malformed request line.");
        }

        Map<String, String> headers = new HashMap<>();
        String line;
        while ((line = readLine(input)) != null && !line.isEmpty()) {
            int colon = line.indexOf(':');
            if (colon > 0) {
                headers.put(line.substring(0, colon).trim().toLowerCase(Locale.US), line.substring(colon + 1).trim());
            }
        }

        return new Request(parts[0].toUpperCase(Locale.US), parts[1], headers);
    }

    private static String readLine(InputStream input) throws IOException, HttpException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int previous = -1;
        int value;

        while ((value = input.read()) != -1) {
            if (value == '\n') {
                break;
            }
            if (previous == '\r') {
                buffer.write('\r');
            }
            if (value != '\r') {
                buffer.write(value);
            }
            previous = value;
            if (buffer.size() > MAX_HEADER_LINE) {
                throw new HttpException(431, "Header line is too large.");
            }
        }

        if (value == -1 && buffer.size() == 0) {
            return null;
        }
        return buffer.toString(StandardCharsets.UTF_8.name());
    }

    private static void sendJson(Request request, OutputStream output, int status, JSONObject object) throws IOException {
        byte[] bytes = object.toString().getBytes(StandardCharsets.UTF_8);
        sendBytes(request, output, status, statusText(status), "application/json; charset=utf-8", bytes, null);
    }

    private static void sendBytes(Request request, OutputStream output, int status, String statusText, String contentType, byte[] bytes, Map<String, String> extraHeaders) throws IOException {
        Map<String, String> headers = extraHeaders == null ? new HashMap<>() : new HashMap<>(extraHeaders);
        headers.put("Content-Length", String.valueOf(bytes.length));
        writeHeaders(output, status, statusText, contentType, headers);
        if (!request.headOnly()) {
            output.write(bytes);
        }
    }

    private static void writeHeaders(OutputStream output, int status, String statusText, String contentType, Map<String, String> headers) throws IOException {
        StringBuilder builder = new StringBuilder();
        builder.append("HTTP/1.1 ").append(status).append(' ').append(statusText).append("\r\n");
        builder.append("Connection: close\r\n");
        builder.append("Access-Control-Allow-Origin: *\r\n");
        builder.append("Access-Control-Allow-Methods: GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS\r\n");
        builder.append("Access-Control-Allow-Headers: Content-Type,X-PocketLAN-PIN\r\n");
        builder.append("Content-Type: ").append(contentType).append("\r\n");
        for (Map.Entry<String, String> header : headers.entrySet()) {
            builder.append(header.getKey()).append(": ").append(header.getValue()).append("\r\n");
        }
        builder.append("\r\n");
        output.write(builder.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static Range parseRange(String header, long size) throws HttpException {
        if (header == null || header.isEmpty() || !header.startsWith("bytes=")) {
            return new Range(0, Math.max(0, size - 1), false);
        }

        String value = header.substring("bytes=".length());
        int dash = value.indexOf('-');
        if (dash < 0) {
            throw new HttpException(416, "Invalid range.");
        }

        long start;
        long end;
        try {
            String startText = value.substring(0, dash).trim();
            String endText = value.substring(dash + 1).trim();
            if (startText.isEmpty()) {
                long suffix = Long.parseLong(endText);
                start = Math.max(0, size - suffix);
                end = Math.max(0, size - 1);
            } else {
                start = Long.parseLong(startText);
                end = endText.isEmpty() ? Math.max(0, size - 1) : Long.parseLong(endText);
            }
        } catch (NumberFormatException error) {
            throw new HttpException(416, "Invalid range.");
        }

        if (size <= 0) {
            return new Range(0, -1, false);
        }
        if (start < 0 || end < start || start >= size) {
            throw new HttpException(416, "Range is not satisfiable.");
        }
        end = Math.min(end, size - 1);
        return new Range(start, end, true);
    }

    private static String safeHeaderValue(String value) {
        return value == null ? "download" : value.replace("\"", "'").replace("\r", "").replace("\n", "");
    }

    private static String staticAssetPath(String path) {
        String raw = path == null || path.isEmpty() || "/".equals(path) ? "index.html" : path;
        if (raw.startsWith("/")) {
            raw = raw.substring(1);
        }
        if (raw.endsWith("/")) {
            raw = raw + "index.html";
        }

        String normalized = raw.replace('\\', '/');
        if (normalized.contains("\0")) {
            return null;
        }

        StringBuilder builder = new StringBuilder();
        for (String part : normalized.split("/")) {
            if (part.isEmpty() || ".".equals(part) || "..".equals(part)) {
                return null;
            }
            if (builder.length() > 0) {
                builder.append('/');
            }
            builder.append(part);
        }
        return builder.length() == 0 ? "index.html" : builder.toString();
    }

    private static boolean shouldServeIndexFallback(String path) {
        if (path == null || path.isEmpty() || "/".equals(path)) {
            return true;
        }
        int slash = path.lastIndexOf('/');
        String name = slash >= 0 ? path.substring(slash + 1) : path;
        return !name.contains(".");
    }

    private static String contentTypeForAsset(String assetPath) {
        String lower = assetPath.toLowerCase(Locale.US);
        if (lower.endsWith(".html")) return "text/html; charset=utf-8";
        if (lower.endsWith(".css")) return "text/css; charset=utf-8";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript; charset=utf-8";
        if (lower.endsWith(".json")) return "application/json; charset=utf-8";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private static String safeZipSegment(String value) {
        String safe = value == null ? "item" : value.replace('\0', ' ').replace('/', '_').replace('\\', '_').trim();
        return safe.isEmpty() ? "item" : safe;
    }

    private static String uniqueZipEntryName(String entryName, Set<String> usedEntries) {
        String normalized = entryName.replace('\\', '/');
        boolean directory = normalized.endsWith("/");
        String trimmed = directory ? normalized.substring(0, normalized.length() - 1) : normalized;
        String candidate = directory ? trimmed + "/" : trimmed;
        if (usedEntries.add(candidate)) {
            return candidate;
        }

        int slash = trimmed.lastIndexOf('/');
        String parent = slash >= 0 ? trimmed.substring(0, slash + 1) : "";
        String name = slash >= 0 ? trimmed.substring(slash + 1) : trimmed;
        String base = name;
        String extension = "";

        if (!directory) {
            int dot = name.lastIndexOf('.');
            if (dot > 0) {
                base = name.substring(0, dot);
                extension = name.substring(dot);
            }
        }

        int index = 2;
        while (true) {
            candidate = parent + base + " (" + index + ")" + extension + (directory ? "/" : "");
            if (usedEntries.add(candidate)) {
                return candidate;
            }
            index += 1;
        }
    }

    private static String statusText(int status) {
        switch (status) {
            case 200:
                return "OK";
            case 201:
                return "Created";
            case 204:
                return "No Content";
            case 206:
                return "Partial Content";
            case 400:
                return "Bad Request";
            case 401:
                return "Unauthorized";
            case 404:
                return "Not Found";
            case 405:
                return "Method Not Allowed";
            case 409:
                return "Conflict";
            case 411:
                return "Length Required";
            case 413:
                return "Payload Too Large";
            case 416:
                return "Range Not Satisfiable";
            case 431:
                return "Request Header Fields Too Large";
            case 500:
            default:
                return "Server Error";
        }
    }

    private static final class Range {
        final long start;
        final long end;
        final boolean partial;

        Range(long start, long end, boolean partial) {
            this.start = start;
            this.end = end;
            this.partial = partial;
        }

        long length() {
            if (end < start) {
                return 0;
            }
            return end - start + 1;
        }
    }

    private static final class Request {
        final String method;
        final String path;
        final Map<String, String> headers;
        final Map<String, String> query;

        Request(String method, String target, Map<String, String> headers) {
            this.method = method;
            this.headers = headers;

            int question = target.indexOf('?');
            String rawPath = question >= 0 ? target.substring(0, question) : target;
            String rawQuery = question >= 0 ? target.substring(question + 1) : "";
            this.path = decode(rawPath.isEmpty() ? "/" : rawPath);
            this.query = parseQuery(rawQuery);
        }

        String header(String name) {
            return headers.get(name.toLowerCase(Locale.US));
        }

        String query(String name) {
            String value = query.get(name);
            return value == null ? "" : value;
        }

        long contentLength() {
            try {
                String value = header("content-length");
                return value == null ? -1 : Long.parseLong(value);
            } catch (NumberFormatException error) {
                return -1;
            }
        }

        boolean headOnly() {
            return "HEAD".equals(method);
        }

        private static Map<String, String> parseQuery(String rawQuery) {
            Map<String, String> result = new HashMap<>();
            if (rawQuery == null || rawQuery.isEmpty()) {
                return result;
            }
            for (String part : rawQuery.split("&")) {
                if (part.isEmpty()) {
                    continue;
                }
                int equals = part.indexOf('=');
                String name = equals >= 0 ? part.substring(0, equals) : part;
                String value = equals >= 0 ? part.substring(equals + 1) : "";
                result.put(decode(name), decode(value));
            }
            return result;
        }

        private static String decode(String value) {
            try {
                return URLDecoder.decode(value, "UTF-8");
            } catch (Exception ignored) {
                return value;
            }
        }
    }
}
