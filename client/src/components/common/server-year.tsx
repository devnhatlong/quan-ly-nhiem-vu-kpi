"use client";

import { useServerTime } from "@/hooks/use-server-time";
import { serverDayjs } from "@/lib/server-time";

/**
 * Năm hiện tại theo giờ server. Trang đăng nhập được dựng tĩnh lúc build nên
 * `new Date()` ở đó sẽ đóng băng năm build; đây tính lại trên trình duyệt.
 */
export function ServerYear() {
  const { ready } = useServerTime();
  return ready ? <>{serverDayjs().year()}</> : null;
}
