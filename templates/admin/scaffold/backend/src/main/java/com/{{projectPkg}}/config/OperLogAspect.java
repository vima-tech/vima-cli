package com.{{projectPkg}}.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.{{projectPkg}}.entity.OperLog;
import com.{{projectPkg}}.service.LogService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class OperLogAspect {
    private final LogService logService;
    private final ObjectMapper objectMapper;

    // MessageController.stream 必须排除，且不只是"不值得记"：它是 SSE 长连接端点，
    // 请求在连接存续期内不结束；这里若写一条操作日志，OSIV 的 EntityManager 就会
    // 拿住一条数据库连接陪跑整个长连接，每个订阅漏一条，连接池很快被打满全站卡死
    // （详见 MessagePushService 的注释）。SSE 订阅是基础设施通道，业务操作日志不记它。
    @Pointcut("execution(* com.{{projectPkg}}.controller..*(..)) && !execution(* com.{{projectPkg}}.controller.AuthController.*(..)) && !execution(* com.{{projectPkg}}.controller.HealthController.*(..)) && !execution(* com.{{projectPkg}}.controller.MessageController.stream(..))")
    public void controllerPointcut() {}

    @Around("controllerPointcut()")
    public Object around(ProceedingJoinPoint point) throws Throwable {
        long startTime = System.currentTimeMillis();
        OperLog operLog = new OperLog();

        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                operLog.setRequestUrl(request.getRequestURI());
                operLog.setRequestMethod(request.getMethod());
                operLog.setIp(getClientIp(request));
            }

            operLog.setMethod(point.getSignature().toShortString());
            operLog.setModule(point.getTarget().getClass().getSimpleName());

            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getName() != null) {
                operLog.setUsername(auth.getName());
            }

            try {
                operLog.setRequestParams(objectMapper.writeValueAsString(point.getArgs()));
            } catch (Exception e) {
                operLog.setRequestParams("参数序列化失败");
            }

            Object result = point.proceed();

            operLog.setStatus(1);
            operLog.setCostTime(System.currentTimeMillis() - startTime);

            try {
                operLog.setResponseResult(objectMapper.writeValueAsString(result));
            } catch (Exception e) {
                operLog.setResponseResult("结果序列化失败");
            }

            return result;
        } catch (Throwable e) {
            operLog.setStatus(0);
            operLog.setErrorMsg(e.getMessage());
            operLog.setCostTime(System.currentTimeMillis() - startTime);
            throw e;
        } finally {
            logService.saveOperLog(operLog);
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip.contains(",") ? ip.split(",")[0].trim() : ip;
    }
}
