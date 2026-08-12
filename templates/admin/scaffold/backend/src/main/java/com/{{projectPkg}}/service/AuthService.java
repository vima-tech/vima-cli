package com.{{projectPkg}}.service;

import com.{{projectPkg}}.dto.ChangePasswordRequest;
import com.{{projectPkg}}.dto.LoginRequest;
import com.{{projectPkg}}.dto.LoginResponse;
import com.{{projectPkg}}.entity.LoginLog;
import com.{{projectPkg}}.entity.User;
import com.{{projectPkg}}.repository.UserRepository;
import com.{{projectPkg}}.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final LogService logService;
    private final PermissionService permissionService;

    public LoginResponse login(LoginRequest request, String ip) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElse(null);

        LoginLog loginLog = new LoginLog();
        loginLog.setUsername(request.getUsername());
        loginLog.setIp(ip);
        loginLog.setBrowser("Unknown");
        loginLog.setOs("Unknown");

        if (user == null) {
            loginLog.setStatus(0);
            loginLog.setMsg("用户不存在");
            logService.saveLoginLog(loginLog);
            throw new RuntimeException("用户不存在");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            loginLog.setStatus(0);
            loginLog.setMsg("密码错误");
            logService.saveLoginLog(loginLog);
            throw new RuntimeException("密码错误");
        }

        if (user.getStatus() != 1) {
            loginLog.setStatus(0);
            loginLog.setMsg("用户已被禁用");
            logService.saveLoginLog(loginLog);
            throw new RuntimeException("用户已被禁用");
        }

        loginLog.setStatus(1);
        loginLog.setMsg("登录成功");
        logService.saveLoginLog(loginLog);

        String token = jwtUtil.generateToken(user.getUsername());

        return LoginResponse.builder()
                .token(token)
                .username(user.getUsername())
                .realName(user.getRealName())
                .build();
    }

    public Map<String, Object> getUserInfo(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        Map<String, Object> info = new HashMap<>();
        info.put("id", user.getId());
        info.put("username", user.getUsername());
        info.put("realName", user.getRealName());
        info.put("email", user.getEmail());
        info.put("phone", user.getPhone());
        info.put("deptId", user.getDeptId());
        info.put("status", user.getStatus());
        info.put("roles", user.getRoles().stream().map(r -> r.getRoleKey()).toList());
        info.put("permissions", user.getRoles().stream()
                .flatMap(r -> r.getMenus().stream())
                .map(m -> m.getPerms())
                .filter(p -> p != null && !p.isEmpty())
                .distinct()
                .toList());
        // perms：按钮级权限串集合（admin 角色为 ["*"] 通配），前端 v-perm 指令按此隐藏按钮
        info.put("perms", List.copyOf(permissionService.getPerms(username)));
        // menuPaths：该用户可见菜单 path 列表，前端按此过滤路由与侧边栏
        info.put("menuPaths", permissionService.getMenuPaths(username));

        return info;
    }

    public void changePassword(String username, ChangePasswordRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new RuntimeException("旧密码错误");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    public void logout(String token) {
        if (token != null && !token.isEmpty()) {
            jwtUtil.removeToken(token);
        }
    }
}
