package com.{{projectPkg}}.utils;

import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * 常用数据校验（零第三方依赖，纯正则 + 校验位算法）。
 *
 * <p>两种用法：
 * <ul>
 *   <li>Service 层随手判定：{@code if (!ValidateUtil.isMobile(phone)) throw ...}</li>
 *   <li>DTO 声明式校验：{@code @ValidFormat(Format.MOBILE) private String phone;}</li>
 * </ul>
 *
 * <p>空值语义与 jakarta.validation 的 {@code @Pattern} 保持一致：null / 空白串一律放行，
 * 「不能为空」交给 {@code @NotBlank} 表达。两条约束是正交的，别在这里混着判。
 *
 * <p>前端有一份同口径实现（frontend src/utils/validate.ts），改这里的规则请同步改那边，
 * 否则会出现前端放行、后端 40001 的错位。
 */
public final class ValidateUtil {

    private static final Pattern MOBILE = Pattern.compile("^1[3-9]\\d{9}$");
    /** 固话：区号（可选）+ 7~8 位号码 + 分机号（可选） */
    private static final Pattern TELEPHONE = Pattern.compile("^(0\\d{2,3}-?)?[1-9]\\d{6,7}(-\\d{1,6})?$");
    private static final Pattern EMAIL = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)+$");
    private static final Pattern URL = Pattern.compile("^https?://[^\\s/$.?#][^\\s]*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern IPV4 = Pattern.compile(
            "^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$");
    private static final Pattern POSTAL_CODE = Pattern.compile("^[1-9]\\d{5}$");
    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z][A-Za-z0-9_]{3,19}$");
    /** 中文姓名，允许 · 分隔的少数民族姓名 */
    private static final Pattern CHINESE_NAME = Pattern.compile("^[一-龥]{2,20}(·[一-龥]{2,20})*$");
    private static final Pattern ID_CARD = Pattern.compile(
            "^[1-9]\\d{5}(19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]$");
    private static final Pattern BANK_CARD = Pattern.compile("^\\d{15,19}$");
    private static final Pattern USCC = Pattern.compile("^[0-9A-HJ-NP-RTUW-Y]{18}$");
    private static final Pattern INTEGER = Pattern.compile("^-?\\d+$");

    private static final int[] ID_CARD_WEIGHTS = {7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2};
    private static final char[] ID_CARD_CHECK_CODES = {'1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'};

    /** GB 32100-2015 字符集，去掉了形近的 I O S V Z */
    private static final String USCC_CHARSET = "0123456789ABCDEFGHJKLMNPQRTUWXY";
    private static final int[] USCC_WEIGHTS = {1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28};

    private ValidateUtil() {
    }

    /**
     * 可用于 {@link ValidFormat} 注解的校验类型。
     * 每个枚举项自带默认错误文案，注解不写 message 时用它。
     */
    public enum Format {

        MOBILE(ValidateUtil::isMobile, "手机号格式不正确"),
        TELEPHONE(ValidateUtil::isTelephone, "固定电话格式不正确"),
        EMAIL(ValidateUtil::isEmail, "邮箱格式不正确"),
        ID_CARD(ValidateUtil::isIdCard, "身份证号格式不正确"),
        BANK_CARD(ValidateUtil::isBankCard, "银行卡号格式不正确"),
        USCC(ValidateUtil::isUSCC, "统一社会信用代码格式不正确"),
        /** 非负、最多两位小数；需要限定上下限请再叠加 @DecimalMin / @DecimalMax */
        AMOUNT(ValidateUtil::isAmount, "金额格式不正确，最多两位小数"),
        /** 非负整数；需要限定上下限请再叠加 @Min / @Max */
        INTEGER(ValidateUtil::isInteger, "必须是非负整数"),
        URL(ValidateUtil::isUrl, "链接格式不正确"),
        IPV4(ValidateUtil::isIPv4, "IP 地址格式不正确"),
        POSTAL_CODE(ValidateUtil::isPostalCode, "邮政编码格式不正确"),
        CHINESE_NAME(ValidateUtil::isChineseName, "姓名需为 2~20 位中文"),
        USERNAME(ValidateUtil::isUsername, "用户名需以字母开头，4~20 位字母、数字或下划线"),
        PASSWORD(ValidateUtil::isStrongPassword, "密码需 8~20 位且包含大写字母、小写字母、数字、符号中的至少三类");

        private final Predicate<String> assertion;
        private final String message;

        Format(Predicate<String> assertion, String message) {
            this.assertion = assertion;
            this.message = message;
        }

        /** 校验单个值；null / 空白串一律放行（见类注释的空值语义）。 */
        public boolean test(String value) {
            return isBlank(value) || assertion.test(value);
        }

        public String getMessage() {
            return message;
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /** 统一预处理：null 归一成空串，两端去空白。 */
    private static String text(String value) {
        return value == null ? "" : value.trim();
    }

    /** 手机号（中国大陆 11 位）。 */
    public static boolean isMobile(String value) {
        return MOBILE.matcher(text(value)).matches();
    }

    /** 固定电话，如 010-12345678、0571-1234567-123、12345678。 */
    public static boolean isTelephone(String value) {
        return TELEPHONE.matcher(text(value)).matches();
    }

    /** 邮箱地址。 */
    public static boolean isEmail(String value) {
        return EMAIL.matcher(text(value)).matches();
    }

    /**
     * 居民身份证号（18 位）。
     * 格式 + 出生日期真实性 + ISO 7064:1983 MOD 11-2 校验位三重校验。
     * 15 位一代证 1999 年起停发，新录入不可能出现，故不支持。
     */
    public static boolean isIdCard(String value) {
        String id = text(value);
        if (!ID_CARD.matcher(id).matches()) {
            return false;
        }

        // 出生日期必须是真实存在的日期（正则拦不住 2 月 30 日）
        try {
            LocalDate.of(
                    Integer.parseInt(id.substring(6, 10)),
                    Integer.parseInt(id.substring(10, 12)),
                    Integer.parseInt(id.substring(12, 14)));
        } catch (DateTimeException e) {
            return false;
        }

        int sum = 0;
        for (int i = 0; i < 17; i++) {
            sum += (id.charAt(i) - '0') * ID_CARD_WEIGHTS[i];
        }
        return ID_CARD_CHECK_CODES[sum % 11] == Character.toUpperCase(id.charAt(17));
    }

    /** 银行卡号：15~19 位数字且通过 Luhn 校验（忽略空格与短横线）。 */
    public static boolean isBankCard(String value) {
        String card = text(value).replaceAll("[\\s-]", "");
        if (!BANK_CARD.matcher(card).matches()) {
            return false;
        }

        // Luhn：从右往左，偶数位（下标从 1 起）翻倍，超过 9 减 9，总和能被 10 整除
        int sum = 0;
        for (int i = 0; i < card.length(); i++) {
            int digit = card.charAt(card.length() - 1 - i) - '0';
            if (i % 2 == 1) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            sum += digit;
        }
        return sum % 10 == 0;
    }

    /** 统一社会信用代码（GB 32100-2015，18 位）。 */
    public static boolean isUSCC(String value) {
        String code = text(value).toUpperCase();
        if (!USCC.matcher(code).matches()) {
            return false;
        }

        int sum = 0;
        for (int i = 0; i < 17; i++) {
            int index = USCC_CHARSET.indexOf(code.charAt(i));
            if (index < 0) {
                return false;
            }
            sum += index * USCC_WEIGHTS[i];
        }
        return USCC_CHARSET.charAt((31 - sum % 31) % 31) == code.charAt(17);
    }

    /** 金额：非负、最多两位小数。 */
    public static boolean isAmount(String value) {
        return isAmount(value, 2, BigDecimal.ZERO, null);
    }

    /**
     * 金额，可指定小数位与上下限。
     * 先用字符串判小数位再转 BigDecimal 比范围——不要用 double，两位小数的钱经不起浮点误差。
     *
     * @param decimals 允许的最大小数位数
     * @param min      下限，null 表示不限
     * @param max      上限，null 表示不限
     */
    public static boolean isAmount(String value, int decimals, BigDecimal min, BigDecimal max) {
        String amount = text(value);
        String regex = decimals > 0 ? "^-?\\d+(\\.\\d{1," + decimals + "})?$" : "^-?\\d+$";
        if (!amount.matches(regex)) {
            return false;
        }

        BigDecimal number = new BigDecimal(amount);
        return (min == null || number.compareTo(min) >= 0)
                && (max == null || number.compareTo(max) <= 0);
    }

    /** 非负整数。 */
    public static boolean isInteger(String value) {
        return isInteger(value, 0L, Long.MAX_VALUE);
    }

    /** 整数，可指定上下限（闭区间）。 */
    public static boolean isInteger(String value, long min, long max) {
        String input = text(value);
        if (!INTEGER.matcher(input).matches()) {
            return false;
        }

        try {
            long number = Long.parseLong(input);
            return number >= min && number <= max;
        } catch (NumberFormatException e) {
            // 位数超出 long 范围，按越界处理
            return false;
        }
    }

    /** http/https 链接。 */
    public static boolean isUrl(String value) {
        return URL.matcher(text(value)).matches();
    }

    /** IPv4 地址。 */
    public static boolean isIPv4(String value) {
        return IPV4.matcher(text(value)).matches();
    }

    /** 邮政编码（6 位，首位非 0）。 */
    public static boolean isPostalCode(String value) {
        return POSTAL_CODE.matcher(text(value)).matches();
    }

    /** 中文姓名，2~20 个汉字。 */
    public static boolean isChineseName(String value) {
        return CHINESE_NAME.matcher(text(value)).matches();
    }

    /** 用户名：字母开头，4~20 位字母、数字或下划线。 */
    public static boolean isUsername(String value) {
        return USERNAME.matcher(text(value)).matches();
    }

    /**
     * 密码强度：8~20 位、不含空格，且大写字母 / 小写字母 / 数字 / 符号四类中至少占三类。
     * 注意用原值判定，不做 trim——首尾空格在密码里是有效字符且这里明确不允许。
     */
    public static boolean isStrongPassword(String value) {
        String password = value == null ? "" : value;
        if (!password.matches("^\\S{8,20}$")) {
            return false;
        }

        int kinds = 0;
        if (password.matches(".*[A-Z].*")) {
            kinds++;
        }
        if (password.matches(".*[a-z].*")) {
            kinds++;
        }
        if (password.matches(".*\\d.*")) {
            kinds++;
        }
        if (password.matches(".*[^A-Za-z0-9].*")) {
            kinds++;
        }
        return kinds >= 3;
    }
}
