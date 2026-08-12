package com.{{projectPkg}}.security;

import com.{{projectPkg}}.service.PermissionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class TokenAuthFilter extends OncePerRequestFilter {

    private final TokenService tokenService;
    private final PermissionService permissionService;

    /**
     * 认证结果除了塞进 SecurityContextHolder，还要存进这个仓库——两者缺一不可。
     * <p>
     * 本过滤器是 OncePerRequestFilter，其 {@code shouldNotFilterAsyncDispatch()} 默认为 true：
     * SSE（SseEmitter）这类异步请求在结束时会由容器再派发一次（ASYNC dispatch）走完整条过滤器链，
     * 而本过滤器在那一次不再执行。SecurityContextHolder 是 ThreadLocal，早已随首次请求清空，
     * 于是 AuthorizationFilter 在回派时看到匿名用户，抛 AccessDeniedException；此时 SSE 首帧
     * 已经写出、响应 committed，异常无法转成 401，只能在日志里刷一整篇栈——长连接每断一次刷一次。
     * <p>
     * STATELESS 策略下 Spring Security 的默认仓库正是 RequestAttributeSecurityContextRepository
     * （存请求属性，不建会话），SecurityContextHolderFilter 在每次派发（含 ASYNC）都会从它加载，
     * 所以存一份就能让回派时的认证上下文接上，且不引入任何服务端会话状态。
     */
    private final SecurityContextRepository securityContextRepository = new RequestAttributeSecurityContextRepository();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        String token = null;

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        } else if (request.getRequestURI().endsWith("/api/system/message/stream")) {
            // SSE 订阅端点独享的 token 携带方式：EventSource 无法自定义请求头，
            // 只能走 query 参数。仅对这一个端点放开，其余接口一律 Authorization 头，
            // 避免 token 出现在 URL（访问日志、Referer）的面被扩大。
            token = request.getParameter("token");
        }

        if (token != null) {
            // 一次 Redis 查询同时完成"取用户名"与"校验有效性"：查得到即有效
            String username = tokenService.getUsernameFromToken(token);

            if (username != null) {
                // 滑动续期：一直在操作的人不会突然在满 24h 时掉线
                tokenService.renewToken(token, username);

                // 认证通过后装载该用户的 perms 集合作为 authorities（admin 角色为单个 "*" 通配），
                // 供 @PreAuthorize("@perm.has('xxx')") 做按钮级鉴权。
                // perms 走 Redis 缓存，不是每请求一次库查询，见 PermissionService。
                List<GrantedAuthority> authorities = permissionService.getPerms(username).stream()
                        .map(p -> (GrantedAuthority) new SimpleGrantedAuthority(p))
                        .toList();
                UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(username, null, authorities);
                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(authentication);
                SecurityContextHolder.setContext(context);
                // 存一份供 ASYNC 回派时重新加载，原因见 securityContextRepository 字段注释
                securityContextRepository.saveContext(context, request, response);
            }
            // token 无效时不抛异常：交给后续的授权链，由 SecurityConfig 的 entry point 统一回 401
        }

        filterChain.doFilter(request, response);
    }
}
