package com.{{projectPkg}}.service;

import com.{{projectPkg}}.dto.PageResponse;
import com.{{projectPkg}}.entity.LoginLog;
import com.{{projectPkg}}.entity.OperLog;
import com.{{projectPkg}}.repository.LoginLogRepository;
import com.{{projectPkg}}.repository.OperLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LogService {
    private final OperLogRepository operLogRepository;
    private final LoginLogRepository loginLogRepository;

    public void saveOperLog(OperLog operLog) {
        operLogRepository.save(operLog);
    }

    public PageResponse<OperLog> listOperLogs(int pageNum, int pageSize) {
        Page<OperLog> page = operLogRepository.findAllByOrderByOperTimeDesc(PageRequest.of(pageNum - 1, pageSize));
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

    public PageResponse<LoginLog> listLoginLogs(int pageNum, int pageSize) {
        Page<LoginLog> page = loginLogRepository.findAllByOrderByLoginTimeDesc(PageRequest.of(pageNum - 1, pageSize));
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
}
