// @vima device-api-be
// 设备模块 Controller：路径/参数/响应/错误码严格按 docs/contracts/device-api.md。
package demo;

import java.util.List;

public class DeviceController {

    /** GET /api/device/list —— 设备分页查询（40001 参数校验失败） */
    public Object list(String name, String status, int pageNum, int pageSize) {
        return List.of();
    }

    /** POST /api/device —— 新增设备（name 2-50 字符，type 枚举；40001） */
    public Object create(String name, String type) {
        return null;
    }

    /** POST /api/device/batch-delete —— 批量删除（最多 100 条；40002/40003） */
    public Object batchDelete(List<Long> ids) {
        return null;
    }

    /** GET /api/device/detail —— 设备详情（40004 设备不存在） */
    public Object detail(Long id) {
        return null;
    }
}
