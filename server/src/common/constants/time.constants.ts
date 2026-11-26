/**
 * Múi giờ nghiệp vụ - mọi "hôm nay", hạn, ngày giao đều tính theo múi này, kể
 * cả khi máy chủ đặt múi giờ khác (VD UTC). Đổi qua biến môi trường
 * BUSINESS_TIMEZONE nếu cần.
 */
export const BUSINESS_TIMEZONE =
  process.env.BUSINESS_TIMEZONE?.trim() || 'Asia/Ho_Chi_Minh';
