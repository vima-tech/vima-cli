package com.{{projectPkg}}.service;

import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.LoginLog;
import com.{{projectPkg}}.entity.OperLog;
import com.{{projectPkg}}.repository.LoginLogRepository;
import com.{{projectPkg}}.repository.OperLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class LogService {
    private final OperLogRepository operLogRepository;
    private final LoginLogRepository loginLogRepository;

    public void saveOperLog(OperLog operLog) {
        operLogRepository.save(operLog);
    }

    /**
     * 操作日志分页查询。
     *
     * module 是 Controller 类名（AOP 记录时写入），前端下拉展示的是中文名，值仍传类名，
     * 所以这里按等值匹配；操作人是模糊匹配，状态 1=成功 0=失败。
     */
    public PageResponse<OperLog> listOperLogs(String module, String username, Integer status, int pageNum, int pageSize) {
        Specification<OperLog> spec = Specification.where(null);

        if (module != null && !module.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("module"), module));
        }
        if (username != null && !username.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("username"), "%" + username + "%"));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }

        Page<OperLog> page = operLogRepository.findAll(spec,
                PageRequest.of(pageNum - 1, pageSize, Sort.by(Sort.Direction.DESC, "operTime")));

        return PageResponse.<OperLog>builder()
                .records(page.getContent())
                .total(page.getTotalElements())
                .pageNum(pageNum)
                .pageSize(pageSize)
                .build();
    }

    public void clearOperLogs() {
        operLogRepository.deleteAll();
    }

    public void saveLoginLog(LoginLog loginLog) {
        loginLogRepository.save(loginLog);
    }

    /** 登录日志分页查询：用户名模糊、状态等值。 */
    public PageResponse<LoginLog> listLoginLogs(String username, Integer status, int pageNum, int pageSize) {
        Specification<LoginLog> spec = Specification.where(null);

        if (username != null && !username.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("username"), "%" + username + "%"));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }

        Page<LoginLog> page = loginLogRepository.findAll(spec,
                PageRequest.of(pageNum - 1, pageSize, Sort.by(Sort.Direction.DESC, "loginTime")));

        return PageResponse.<LoginLog>builder()
                .records(page.getContent())
                .total(page.getTotalElements())
                .pageNum(pageNum)
                .pageSize(pageSize)
                .build();
    }

    public void clearLoginLogs() {
        loginLogRepository.deleteAll();
    }

    /** 删除 time 之前的操作日志，返回删除条数（供 DbLogRetentionJob 按保留期清理） */
    @Transactional
    public int purgeOperLogsBefore(LocalDateTime time) {
        return operLogRepository.deleteOlderThan(time);
    }

    /** 删除 time 之前的登录日志，返回删除条数 */
    @Transactional
    public int purgeLoginLogsBefore(LocalDateTime time) {
        return loginLogRepository.deleteOlderThan(time);
    }
}
