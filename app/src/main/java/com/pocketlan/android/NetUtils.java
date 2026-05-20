package com.pocketlan.android;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class NetUtils {
    private NetUtils() {
    }

    static List<String> accessUrls(int port, String customIp) {
        Set<String> urls = new LinkedHashSet<>();
        String customAddress = normalizeCustomIp(customIp);
        if (!customAddress.isEmpty()) {
            urls.add("http://" + customAddress + ":" + port);
        }

        for (String address : lanIpv4Addresses()) {
            urls.add("http://" + address + ":" + port);
        }

        urls.add("http://127.0.0.1:" + port);
        urls.add("http://localhost:" + port);

        return new ArrayList<>(urls);
    }

    static List<String> accessUrls(int port) {
        return accessUrls(port, "");
    }

    static List<String> lanIpv4Addresses() {
        List<String> addresses = new ArrayList<>();

        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            for (NetworkInterface networkInterface : Collections.list(interfaces)) {
                if (!networkInterface.isUp() || networkInterface.isLoopback() || networkInterface.isVirtual()) {
                    continue;
                }

                Enumeration<InetAddress> inetAddresses = networkInterface.getInetAddresses();
                for (InetAddress inetAddress : Collections.list(inetAddresses)) {
                    if (!(inetAddress instanceof Inet4Address) || inetAddress.isLoopbackAddress()) {
                        continue;
                    }
                    addresses.add(inetAddress.getHostAddress());
                }
            }
        } catch (Exception ignored) {
            // The UI can still use a custom IP if interface enumeration fails.
        }

        return addresses;
    }

    private static String normalizeCustomIp(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.startsWith("http://")) {
            trimmed = trimmed.substring("http://".length());
        } else if (trimmed.startsWith("https://")) {
            trimmed = trimmed.substring("https://".length());
        }
        int slash = trimmed.indexOf('/');
        if (slash >= 0) {
            trimmed = trimmed.substring(0, slash);
        }
        int colon = trimmed.indexOf(':');
        if (colon >= 0) {
            trimmed = trimmed.substring(0, colon);
        }
        return trimmed;
    }
}
