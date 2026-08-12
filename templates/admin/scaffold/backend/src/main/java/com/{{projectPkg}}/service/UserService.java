package com.{{projectPkg}}.service;

import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.dto.UserDTO;
import com.{{projectPkg}}.entity.Dept;
import com.{{projectPkg}}.entity.Role;
import com.{{projectPkg}}.entity.User;
import com.{{projectPkg}}.repository.DeptRepository;
import com.{{projectPkg}}.repository.RoleRepository;
import com.{{projectPkg}}.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final DeptRepository deptRepository;
    private final PasswordEncoder passwordEncoder;

    public PageResponse<UserDTO> listUsers(String username, String realName, Long deptId, int pageNum, int pageSize) {
        Specification<User> spec = buildSpec(username, realName, deptId);

        Page<User> page = userRepository.findAll(spec, PageRequest.of(pageNum - 1, pageSize, Sort.by("createTime").descending()));

        List<UserDTO> records = page.getContent().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());

        return PageResponse.<UserDTO>builder()
                .records(records)
                .total(page.getTotalElements())
                .pageNum(pageNum)
                .pageSize(pageSize)
                .build();
    }

    public UserDTO getUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        return toDTO(user);
    }

    public UserDTO createUser(UserDTO dto) {
        if (userRepository.existsByUsername(dto.getUsername())) {
            throw new RuntimeException("用户名已存在");
        }

        User user = new User();
        user.setUsername(dto.getUsername());
        user.setPassword(passwordEncoder.encode("123456"));
        user.setRealName(dto.getRealName());
        user.setEmail(dto.getEmail());
        user.setPhone(dto.getPhone());
        user.setDeptId(dto.getDeptId());
        user.setStatus(dto.getStatus());

        if (dto.getRoleIds() != null && !dto.getRoleIds().isEmpty()) {
            List<Role> roles = roleRepository.findAllById(dto.getRoleIds());
            user.setRoles(new HashSet<>(roles));
        }

        return toDTO(userRepository.save(user));
    }

    public UserDTO updateUser(UserDTO dto) {
        User user = userRepository.findById(dto.getId())
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        user.setRealName(dto.getRealName());
        user.setEmail(dto.getEmail());
        user.setPhone(dto.getPhone());
        user.setDeptId(dto.getDeptId());
        user.setStatus(dto.getStatus());

        if (dto.getRoleIds() != null) {
            List<Role> roles = roleRepository.findAllById(dto.getRoleIds());
            user.setRoles(new HashSet<>(roles));
        }

        return toDTO(userRepository.save(user));
    }

    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }

    public void resetPassword(Long userId, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    /** 导出：按当前查询条件取全量用户（不分页），并填充部门名称。 */
    public List<UserDTO> listUsersForExport(String username, String realName, Long deptId) {
        List<User> users = userRepository.findAll(buildSpec(username, realName, deptId),
                Sort.by("createTime").descending());
        Map<Long, String> deptNames = deptRepository.findAll().stream()
                .collect(Collectors.toMap(Dept::getId, Dept::getName));
        return users.stream()
                .map(user -> {
                    UserDTO dto = toDTO(user);
                    if (user.getDeptId() != null) {
                        dto.setDeptName(deptNames.get(user.getDeptId()));
                    }
                    return dto;
                })
                .collect(Collectors.toList());
    }

    /** 导入：用户名存在性检查。 */
    public boolean usernameExists(String username) {
        return userRepository.existsByUsername(username);
    }

    /**
     * 导入：创建单个用户。
     * 初始密码 123456——与 DataInitializer 种子数据及登录页提示文案保持一致（种子约定）。
     */
    public void createImportedUser(String username, String realName, String email, String phone, Long deptId) {
        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode("123456"));
        user.setRealName(realName);
        user.setEmail(email);
        user.setPhone(phone);
        user.setDeptId(deptId);
        user.setStatus(1);
        userRepository.save(user);
    }

    private Specification<User> buildSpec(String username, String realName, Long deptId) {
        Specification<User> spec = Specification.where(null);

        if (username != null && !username.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("username"), "%" + username + "%"));
        }
        if (realName != null && !realName.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("realName"), "%" + realName + "%"));
        }
        if (deptId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("deptId"), deptId));
        }
        return spec;
    }

    private UserDTO toDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setRealName(user.getRealName());
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getPhone());
        dto.setDeptId(user.getDeptId());
        dto.setStatus(user.getStatus());
        dto.setCreateTime(user.getCreateTime());
        dto.setRoleIds(user.getRoles().stream().map(Role::getId).collect(Collectors.toSet()));
        return dto;
    }
}
