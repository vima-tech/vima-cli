package com.{{projectPkg}}.config;

import com.{{projectPkg}}.dto.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /** 参数校验失败的业务错误码（契约约定 40001）。 */
    private static final int VALIDATION_FAILED = 40001;

    /**
     * @Valid 校验失败（jakarta.validation 注解、@ValidFormat 等）：400 + 40001。
     * 不接管的话会落到下面的兜底 handler 变成 500，前端只能看到一句框架异常文案。
     * 只取第一条错误：表单是逐字段回显的，一次给一条足够，也避免拼串把内部字段名倒出去。
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .filter(msg -> msg != null && !msg.isBlank())
            .findFirst()
            .orElse("参数校验失败");
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(ApiResponse.error(VALIDATION_FAILED, message));
    }

    /**
     * @PreAuthorize 拒绝（AuthorizationDeniedException 是其子类）：403。
     * 方法安全的拒绝发生在 MVC 内部，会先落到这里，不会走 SecurityConfig 的 accessDeniedHandler；
     * 两处必须返回同一形状，否则前端得按两套格式解析。
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity
            .status(HttpStatus.FORBIDDEN)
            .body(ApiResponse.error(HttpStatus.FORBIDDEN.value(), "无权限访问"));
    }

    /**
     * 业务入参校验失败（如菜单权限标识格式错误）：400 + 40001，与 @Valid 失败同一形状。
     * service 层抛 IllegalArgumentException 表达"这是调用方传错了"，不该落 500 兜底。
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(ApiResponse.error(VALIDATION_FAILED, e.getMessage()));
    }

    /**
     * 兜底：记录完整异常，客户端只收到稳定通用文案，避免泄漏内部路径与数据库细节。
     * <p>
     * 响应已 committed 时返回 null（Spring 视为"已处理、无响应体"）而不是硬写 JSON：
     * SSE 长连接被关页面/刷新掐断、文件流下载写到一半客户端断开，都是常态而非故障，
     * 此时响应头早已发出，再塞一个 ApiResponse 只会抛 HttpMessageNotWritableException
     * （"No converter ... with preset Content-Type 'text/event-stream'"），
     * 让兜底 handler 自己失败，原异常被重新抛给容器，每断一次刷一篇栈。
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e, HttpServletResponse response) {
        if (response.isCommitted()) {
            return null;
        }
        log.error("未处理的服务端异常", e);
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiResponse.error(HttpStatus.INTERNAL_SERVER_ERROR.value(), "服务器内部错误"));
    }
}
