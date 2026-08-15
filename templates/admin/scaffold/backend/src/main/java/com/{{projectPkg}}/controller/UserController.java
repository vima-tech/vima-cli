package com.{{projectPkg}}.controller;

import com.{{projectPkg}}.dto.ApiResponse;
import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.dto.UserDTO;
import com.{{projectPkg}}.service.UserService;
import com.{{projectPkg}}.utils.ExcelUtil;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/system/user")
@RequiredArgsConstructor
public class UserController {
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 导出列与导入模板表头：导出「昵称」列对应导入模板「昵称*」，字段同为 realName。 */
    private static final List<String> EXPORT_HEADERS =
            List.of("ID", "用户名", "昵称", "邮箱", "手机", "状态", "部门", "创建时间");
    private static final List<String> IMPORT_HEADERS =
            List.of("用户名*", "初始密码*", "昵称*", "邮箱", "手机", "部门ID");

    private final UserService userService;

    @PreAuthorize("@perm.has('system:user:list')")
    @GetMapping("/list")
    public ApiResponse<PageResponse<UserDTO>> list(
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String realName,
            @RequestParam(required = false) Long deptId,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        PageResponse<UserDTO> page = userService.listUsers(username, realName, deptId, pageNum, pageSize);
        return ApiResponse.success(page);
    }

    @PreAuthorize("@perm.has('system:user:list')")
    @GetMapping("/{id}")
    public ApiResponse<UserDTO> getById(@PathVariable Long id) {
        return ApiResponse.success(userService.getUser(id));
    }

    @PreAuthorize("@perm.has('system:user:add')")
    @PostMapping
    public ApiResponse<UserDTO> create(@Valid @RequestBody UserDTO dto) {
        try {
            return ApiResponse.success(userService.createUser(dto));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PreAuthorize("@perm.has('system:user:edit')")
    @PutMapping
    public ApiResponse<UserDTO> update(@Valid @RequestBody UserDTO dto) {
        return ApiResponse.success(userService.updateUser(dto));
    }

    @PreAuthorize("@perm.has('system:user:remove')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        userService.deleteUser(id);
        return ApiResponse.success();
    }

    @PreAuthorize("@perm.has('system:user:resetPwd')")
    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@RequestBody Map<String, Object> params) {
        Long userId = Long.valueOf(params.get("userId").toString());
        String newPassword = params.get("newPassword").toString();
        userService.resetPassword(userId, newPassword);
        return ApiResponse.success();
    }

    /** 导出当前查询条件下的全部用户。 */
    @PreAuthorize("@perm.has('system:user:export')")
    @GetMapping("/export")
    public void export(
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String realName,
            @RequestParam(required = false) Long deptId,
            HttpServletResponse response) throws IOException {
        List<UserDTO> users = userService.listUsersForExport(username, realName, deptId);
        List<List<Object>> rows = new ArrayList<>();
        for (UserDTO user : users) {
            rows.add(Arrays.asList(
                    user.getId(),
                    user.getUsername(),
                    user.getRealName(),
                    user.getEmail(),
                    user.getPhone(),
                    user.getStatus() != null && user.getStatus() == 1 ? "启用" : "禁用",
                    user.getDeptName(),
                    user.getCreateTime() == null ? "" : user.getCreateTime().format(DATE_TIME_FORMATTER)));
        }
        ExcelUtil.export(response, "用户数据", EXPORT_HEADERS, rows);
    }

    /** 下载导入模板：表头 + 一行示例。 */
    @PreAuthorize("@perm.has('system:user:import')")
    @GetMapping("/import-template")
    public void importTemplate(HttpServletResponse response) throws IOException {
        List<List<Object>> rows = List.of(
                Arrays.asList("zhangsan", "ChangeMe-2026", "张三", "zhangsan@example.com", "13800138000", 1L));
        ExcelUtil.export(response, "用户导入模板", IMPORT_HEADERS, rows);
    }

    /**
     * 导入用户：解析 Excel → 逐行校验（用户名必填且未存在、昵称必填）→ 合法行创建。
     * 返回 { total, success, failed, errors:[行号+原因] }。
     */
    @PreAuthorize("@perm.has('system:user:import')")
    @PostMapping("/import")
    public ApiResponse<Map<String, Object>> importUsers(@RequestParam("file") MultipartFile file) {
        List<Map<String, String>> sheetRows;
        try {
            sheetRows = ExcelUtil.importSheet(file.getInputStream());
        } catch (IOException e) {
            return ApiResponse.error("文件解析失败，请使用导入模板（.xlsx）");
        }

        int total = sheetRows.size();
        int success = 0;
        List<String> errors = new ArrayList<>();

        for (Map<String, String> row : sheetRows) {
            String rowNum = row.getOrDefault(ExcelUtil.ROW_NUM_KEY, "?");
            String rowUsername = row.getOrDefault("用户名*", "");
            String rowPassword = row.getOrDefault("初始密码*", "");
            String rowRealName = row.getOrDefault("昵称*", "");
            String rowEmail = row.getOrDefault("邮箱", "");
            String rowPhone = row.getOrDefault("手机", "");
            String rowDeptId = row.getOrDefault("部门ID", "");

            if (rowUsername.isEmpty()) {
                errors.add("第" + rowNum + "行：用户名必填");
                continue;
            }
            if (userService.usernameExists(rowUsername)) {
                errors.add("第" + rowNum + "行：用户名「" + rowUsername + "」已存在");
                continue;
            }
            if (rowPassword.length() < 8 || rowPassword.length() > 72) {
                errors.add("第" + rowNum + "行：初始密码长度需在 8~72 位之间");
                continue;
            }
            if (rowRealName.isEmpty()) {
                errors.add("第" + rowNum + "行：昵称必填");
                continue;
            }
            Long parsedDeptId = null;
            if (!rowDeptId.isEmpty()) {
                try {
                    parsedDeptId = Long.valueOf(rowDeptId);
                } catch (NumberFormatException e) {
                    errors.add("第" + rowNum + "行：部门ID格式不正确");
                    continue;
                }
            }

            userService.createImportedUser(
                    rowUsername,
                    rowPassword,
                    rowRealName,
                    rowEmail.isEmpty() ? null : rowEmail,
                    rowPhone.isEmpty() ? null : rowPhone,
                    parsedDeptId);
            success++;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", total);
        result.put("success", success);
        result.put("failed", total - success);
        result.put("errors", errors);
        return ApiResponse.success(result);
    }
}
