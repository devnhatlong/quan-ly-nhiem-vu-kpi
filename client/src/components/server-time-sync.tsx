"use client";

import { useEffect, type ReactNode } from "react";

import { useServerTime } from "@/hooks/use-server-time";
import { syncServerTime } from "@/lib/server-time";

/** Đo lại độ lệch với giờ server định kỳ - người dùng có thể chỉnh giờ máy giữa chừng. */
const RESYNC_MS = 5 * 60 * 1000;

/**
 * Mọi thời gian trên giao diện tính theo giờ server. Chặn render nội dung
 * dashboard tới khi đo xong độ lệch lần đầu (lỗi mạng thì vẫn cho qua, tạm
 * dùng giờ máy) - để các chỗ như "còn 4 ngày", "Hôm nay" không tính bằng giờ
 * máy rồi không bao giờ tính lại.
 *
 * Sau đó đo lại mỗi 5 phút và mỗi khi quay lại tab.
 */
export function ServerTimeSync({ children }: { children: ReactNode }) {
  const { ready } = useServerTime();

  useEffect(() => {
    const resync = () => void syncServerTime().catch(() => undefined);
    const timer = window.setInterval(resync, RESYNC_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="size-9 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }
  return <>{children}</>;
}
