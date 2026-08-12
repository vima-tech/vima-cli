package com.{{projectPkg}}.jobs;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Stream;
import java.util.zip.GZIPOutputStream;

/**
 * 日志归档任务（jobKey=logArchive）：
 * 1. 把最后修改时间早于 log.compress-after-days 天的滚动日志 gzip 压缩为 .log.gz；
 * 2. 把早于 log.retain-days 天的日志（.log 与 .log.gz 都算）删除。
 *
 * 按天/按大小的分段由 logback-spring.xml 完成，本任务不参与写日志。
 * 只处理 "{spring.application.name}-" 开头的滚动文件，因此正在写入的
 * "{spring.application.name}.log" 与目录下其他文件都不会被动到。
 */
@Slf4j
@Component
public class LogArchiveJob implements JobHandler {

    private final Path logDir;
    private final String rolledPrefix;
    private final int compressAfterDays;
    private final int retainDays;

    public LogArchiveJob(@Value("${log.dir:./logs}") String logDir,
                         @Value("${spring.application.name}") String appName,
                         @Value("${log.compress-after-days:7}") int compressAfterDays,
                         @Value("${log.retain-days:30}") int retainDays) {
        this.logDir = Paths.get(logDir);
        this.rolledPrefix = appName + "-";
        this.compressAfterDays = compressAfterDays;
        this.retainDays = retainDays;
    }

    @Override
    public String key() {
        return "logArchive";
    }

    @Override
    public void execute() {
        if (compressAfterDays < 1 || retainDays < 1) {
            log.error("[LogArchiveJob] 配置非法：log.compress-after-days={}、log.retain-days={} 都必须 ≥ 1，本次不执行",
                    compressAfterDays, retainDays);
            return;
        }
        // 压缩天数 ≥ 保留天数时，文件会先被删干净，压缩永远轮不到。
        // 这种配置多半是写错了，但删除本身仍是安全的，所以只降级不中止。
        boolean compressEnabled = compressAfterDays < retainDays;
        if (!compressEnabled) {
            log.warn("[LogArchiveJob] log.compress-after-days({}) ≥ log.retain-days({})，压缩不会发生，本次只做过期清理",
                    compressAfterDays, retainDays);
        }

        if (!Files.isDirectory(logDir)) {
            log.warn("[LogArchiveJob] 日志目录不存在，跳过：{}", logDir.toAbsolutePath());
            return;
        }

        Instant now = Instant.now();
        Instant deleteBefore = now.minus(retainDays, ChronoUnit.DAYS);
        Instant compressBefore = now.minus(compressAfterDays, ChronoUnit.DAYS);

        // 先取快照再处理：压缩会在同一目录里新建 .gz，边遍历边改目录不安全
        List<Path> candidates;
        try (Stream<Path> stream = Files.list(logDir)) {
            candidates = stream.filter(Files::isRegularFile).filter(this::isRolledLog).toList();
        } catch (IOException e) {
            log.error("[LogArchiveJob] 列举日志目录失败：{}", e.getMessage(), e);
            return;
        }

        int deleted = 0;
        int compressed = 0;
        for (Path file : candidates) {
            try {
                Instant modified = Files.getLastModifiedTime(file).toInstant();
                if (modified.isBefore(deleteBefore)) {
                    Files.delete(file);
                    deleted++;
                } else if (compressEnabled && modified.isBefore(compressBefore)
                        && file.getFileName().toString().endsWith(".log")) {
                    compress(file, modified);
                    compressed++;
                }
            } catch (IOException e) {
                log.error("[LogArchiveJob] 处理 {} 失败：{}", file.getFileName(), e.getMessage(), e);
            }
        }
        log.info("[LogArchiveJob] 扫描 {} 个滚动日志：压缩 {} 个（早于 {} 天），删除 {} 个（早于 {} 天）",
                candidates.size(), compressed, compressAfterDays, deleted, retainDays);
    }

    /** 只认 logback fileNamePattern 生成的滚动文件，正在写入的当前日志与无关文件一律跳过 */
    private boolean isRolledLog(Path file) {
        String name = file.getFileName().toString();
        return name.startsWith(rolledPrefix) && (name.endsWith(".log") || name.endsWith(".log.gz"));
    }

    /**
     * 压缩单个文件：写临时文件 → 回填原修改时间 → rename → 删原件。
     * 修改时间必须回填，否则 .gz 的时间戳变成"刚才"，保留期就永远算不到头。
     */
    private void compress(Path file, Instant modified) throws IOException {
        Path gz = file.resolveSibling(file.getFileName() + ".gz");
        Path tmp = file.resolveSibling(file.getFileName() + ".gz.tmp");
        try {
            try (InputStream in = Files.newInputStream(file);
                 OutputStream out = new GZIPOutputStream(Files.newOutputStream(tmp))) {
                in.transferTo(out);
            }
            Files.setLastModifiedTime(tmp, FileTime.from(modified));
            Files.move(tmp, gz, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            Files.deleteIfExists(tmp);
            throw e;
        }
        Files.delete(file);
    }
}
