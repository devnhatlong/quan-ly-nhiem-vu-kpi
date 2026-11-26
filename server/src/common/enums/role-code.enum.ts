/**
 * Vai trò trong Ban, từ cao xuống thấp: HEAD › DEPUTY › ASSISTANT.
 * SUPER_ADMIN đứng ngoài chuỗi đó - chỉ quản trị kỹ thuật.
 *
 * Chủ trì, phối hợp, người giao, người xác nhận KHÔNG phải vai trò: đó là tư
 * cách của một người trong từng nhiệm vụ.
 */
export enum RoleCode {
  /** Quản trị hệ thống - tài khoản, cấu hình. */
  SUPER_ADMIN = 'SUPER_ADMIN',
  /** Trưởng ban: xem toàn bộ, giao việc, xác nhận, thống kê, KPI. */
  HEAD = 'HEAD',
  /** Phó ban: xem và quản lý theo phạm vi được giao. */
  DEPUTY = 'DEPUTY',
  /** Trợ lý: nhiệm vụ của mình, cập nhật tiến độ, bổ sung việc, báo kết quả. */
  ASSISTANT = 'ASSISTANT',
}

/**
 * Vai trò hệ thống của bản khung cũ - xoá khỏi CSDL lúc khởi động (xem
 * `RolesService.retireOldSystemRoles`).
 */
export const RETIRED_ROLE_CODES = [
  'CAT_ADMIN',
  'UNIT_ADMIN',
  'VICE_UNIT_ADMIN',
  'MANAGER',
  'STAFF',
  'REPORT_REVIEWER',
] as const;
