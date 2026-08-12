package com.{{projectPkg}}.utils;

import jakarta.servlet.http.HttpServletResponse;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Excel 导入导出工具（基于 poi-ooxml）。
 * 导出：SXSSFWorkbook 流式写，避免大数据量 OOM；
 * 导入：XSSFWorkbook 读首个 sheet，按表头行映射为 Map。
 */
public final class ExcelUtil {

    /**
     * 导入结果中每行 Map 的保留 key：该行在 Excel 中的行号（从 1 开始，含表头行）。
     * 用于导入报错时精确定位「第 N 行」。
     */
    public static final String ROW_NUM_KEY = "__rowNum__";

    private ExcelUtil() {
    }

    /**
     * 流式导出 Excel 并写入 HttpServletResponse。
     *
     * @param response 响应对象（本方法负责设置 Content-Type / Content-Disposition）
     * @param fileName 文件名（不含扩展名，支持中文，按 RFC 5987 filename*=UTF-8 编码）
     * @param headers  表头列表
     * @param rows     行数据，每行与表头一一对应
     */
    public static void export(HttpServletResponse response, String fileName,
                              List<String> headers, List<List<Object>> rows) throws IOException {
        String encodedName = URLEncoder.encode(fileName + ".xlsx", StandardCharsets.UTF_8)
                .replace("+", "%20");
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encodedName);

        // try-with-resources：close() 同时清理 SXSSF 的磁盘临时文件
        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Sheet1");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 20 * 256);
            }

            int rowIndex = 1;
            for (List<Object> rowData : rows) {
                Row row = sheet.createRow(rowIndex++);
                for (int i = 0; i < rowData.size(); i++) {
                    Cell cell = row.createCell(i);
                    Object value = rowData.get(i);
                    if (value == null) {
                        cell.setCellValue("");
                    } else if (value instanceof Number number) {
                        cell.setCellValue(number.doubleValue());
                    } else {
                        cell.setCellValue(value.toString());
                    }
                }
            }

            workbook.write(response.getOutputStream());
        }
    }

    /**
     * 读取 Excel 首个 sheet：首行作为表头，其余行映射为 List&lt;Map&lt;表头, 值&gt;&gt;，空行跳过。
     * 单元格统一经 DataFormatter 转为显示字符串（数值不带多余小数位）。
     * 每行 Map 额外带 {@link #ROW_NUM_KEY} → Excel 中真实行号（字符串），供调用方报错定位。
     */
    public static List<Map<String, String>> importSheet(InputStream in) throws IOException {
        List<Map<String, String>> result = new ArrayList<>();
        try (XSSFWorkbook workbook = new XSSFWorkbook(in)) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                return result;
            }
            Row headerRow = sheet.getRow(sheet.getFirstRowNum());
            if (headerRow == null) {
                return result;
            }

            DataFormatter formatter = new DataFormatter();
            List<String> headers = new ArrayList<>();
            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                headers.add(formatter.formatCellValue(headerRow.getCell(i)).trim());
            }

            for (int r = headerRow.getRowNum() + 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) {
                    continue;
                }
                Map<String, String> rowMap = new LinkedHashMap<>();
                boolean empty = true;
                for (int i = 0; i < headers.size(); i++) {
                    String value = formatter.formatCellValue(row.getCell(i)).trim();
                    if (!value.isEmpty()) {
                        empty = false;
                    }
                    rowMap.put(headers.get(i), value);
                }
                if (empty) {
                    continue;
                }
                rowMap.put(ROW_NUM_KEY, String.valueOf(r + 1));
                result.add(rowMap);
            }
        }
        return result;
    }
}
