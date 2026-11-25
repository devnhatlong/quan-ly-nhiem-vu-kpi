/**
 * Bậc tổ chức từ cao xuống thấp:
 * CAT_ADMIN › UNIT_ADMIN › VICE_UNIT_ADMIN › MANAGER › STAFF.
 * SUPER_ADMIN đứng ngoài chuỗi đó - xem chú thích bên dưới.
 */
export enum RoleCode {
    /** Chỉ cấu hình hệ thống, không nằm trong chuỗi tổ chức. */
    SUPER_ADMIN = 'SUPER_ADMIN',
    /** Công an tỉnh - cấp cao nhất. */
    CAT_ADMIN = 'CAT_ADMIN',
    /** Trưởng phòng, trưởng xã. */
    UNIT_ADMIN = 'UNIT_ADMIN',
    /** Phó phòng, phó xã - đứng thay trưởng nên giữ đúng bộ quyền của trưởng. */
    VICE_UNIT_ADMIN = 'VICE_UNIT_ADMIN',
    /** Đội trưởng. */
    MANAGER = 'MANAGER',
    /** Cán bộ. */
    STAFF = 'STAFF',
}
