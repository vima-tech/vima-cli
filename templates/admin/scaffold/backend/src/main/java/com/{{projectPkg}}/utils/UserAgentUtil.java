package com.{{projectPkg}}.utils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * User-Agent 解析工具（零第三方依赖，纯正则）。
 * 用于登录日志记录浏览器与操作系统，取代此前写死的 "Unknown"。
 *
 * <p>注意：User-Agent 由客户端提供，可被伪造，仅作辅助排查用途，不可作安全判据。
 * 另外现代浏览器会冻结版本号令牌——Windows 10 与 11 同为 "Windows NT 10.0"（故统一记作
 * Windows 10/11），macOS 13+ 仍上报 "Mac OS X 10_15_7"，这是客户端如实上报的内容。
 */
public final class UserAgentUtil {

    /** 无法识别时的占位值，与数据库 browser/os 字段长度（50）兼容。 */
    public static final String UNKNOWN = "Unknown";

    /** browser / os 字段列宽，超长截断避免入库报错。 */
    private static final int MAX_LENGTH = 50;

    private UserAgentUtil() {
    }

    /**
     * 从 User-Agent 中解析浏览器名与主版本号，如 "Chrome 120"、"Safari 17"。
     *
     * @param userAgent 原始 User-Agent 头，可为 null
     * @return 浏览器描述，识别不出时返回 {@link #UNKNOWN}
     */
    public static String parseBrowser(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return UNKNOWN;
        }
        // 顺序敏感：Edge/Opera 的 UA 里含 Chrome，Chrome 的 UA 里含 Safari，必须先特后通
        String result = match(userAgent, "Edg(?:e|A|iOS)?/(\\d+)", "Edge");
        if (result == null) {
            result = match(userAgent, "(?:OPR|Opera)/(\\d+)", "Opera");
        }
        if (result == null) {
            result = match(userAgent, "MicroMessenger/(\\d+)", "WeChat");
        }
        if (result == null) {
            result = match(userAgent, "(?:Firefox|FxiOS)/(\\d+)", "Firefox");
        }
        if (result == null) {
            result = match(userAgent, "(?:Chrome|CriOS)/(\\d+)", "Chrome");
        }
        if (result == null && userAgent.contains("Safari")) {
            result = match(userAgent, "Version/(\\d+)", "Safari");
            if (result == null) {
                result = "Safari";
            }
        }
        if (result == null) {
            // IE11 的 UA 不含 MSIE，只有 Trident/7.0 + rv:11.0
            result = match(userAgent, "MSIE (\\d+)", "IE");
            if (result == null && userAgent.contains("Trident/")) {
                result = match(userAgent, "rv:(\\d+)", "IE");
            }
        }
        return truncate(result == null ? UNKNOWN : result);
    }

    /**
     * 从 User-Agent 中解析操作系统，如 "Windows 10/11"、"Android 13"、"iOS 17"。
     *
     * @param userAgent 原始 User-Agent 头，可为 null
     * @return 操作系统描述，识别不出时返回 {@link #UNKNOWN}
     */
    public static String parseOs(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return UNKNOWN;
        }
        // 顺序敏感：iPad/iPhone 的 UA 里含 "like Mac OS X"，须先于 Mac 判定
        String result = null;
        if (userAgent.contains("Windows NT")) {
            result = windows(userAgent);
        } else if (userAgent.contains("Android")) {
            result = match(userAgent, "Android (\\d+(?:\\.\\d+)?)", "Android");
            if (result == null) {
                result = "Android";
            }
        } else if (userAgent.contains("iPhone") || userAgent.contains("iPad") || userAgent.contains("iPod")) {
            String version = group(userAgent, "OS (\\d+[_.]\\d+)");
            result = version == null ? "iOS" : "iOS " + version.replace('_', '.');
        } else if (userAgent.contains("Mac OS X") || userAgent.contains("Macintosh")) {
            String version = group(userAgent, "Mac OS X (\\d+[_.]\\d+)");
            result = version == null ? "macOS" : "macOS " + version.replace('_', '.');
        } else if (userAgent.contains("HarmonyOS")) {
            result = "HarmonyOS";
        } else if (userAgent.contains("Ubuntu")) {
            result = "Ubuntu";
        } else if (userAgent.contains("Linux") || userAgent.contains("X11")) {
            result = "Linux";
        }
        return truncate(result == null ? UNKNOWN : result);
    }

    /** Windows NT 内核版本号 → 市场版本名。 */
    private static String windows(String userAgent) {
        String nt = group(userAgent, "Windows NT ([\\d.]+)");
        if (nt == null) {
            return "Windows";
        }
        return switch (nt) {
            // 10 与 11 在 UA 上不可区分，均为 NT 10.0
            case "10.0" -> "Windows 10/11";
            case "6.3" -> "Windows 8.1";
            case "6.2" -> "Windows 8";
            case "6.1" -> "Windows 7";
            case "6.0" -> "Windows Vista";
            case "5.2", "5.1" -> "Windows XP";
            default -> "Windows NT " + nt;
        };
    }

    /** 命中则返回「名称 + 空格 + 捕获组」，未命中返回 null。 */
    private static String match(String userAgent, String regex, String name) {
        String version = group(userAgent, regex);
        return version == null ? null : name + " " + version;
    }

    private static String group(String userAgent, String regex) {
        Matcher matcher = Pattern.compile(regex).matcher(userAgent);
        return matcher.find() ? matcher.group(1) : null;
    }

    private static String truncate(String value) {
        return value.length() > MAX_LENGTH ? value.substring(0, MAX_LENGTH) : value;
    }
}
