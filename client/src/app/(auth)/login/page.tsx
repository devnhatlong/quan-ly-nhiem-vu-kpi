import type { Metadata } from "next";
import Image from "next/image";
import { ServerYear } from "@/components/common/server-year";
import { APP_LOGO, APP_NAME } from "@/constants/app";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = {
  // Khuôn ở layout gốc tự nối tên phần mềm.
  title: "Đăng nhập",
  description: `Đăng nhập vào ${APP_NAME}.`,
  openGraph: {
    title: `Đăng nhập - ${APP_NAME}`,
    description: `${APP_NAME}.`,
  },
};

const stats = [
  {
    title: "VẬN HÀNH",
    label: "Số liệu thống nhất, quản lý tập trung trên một hệ thống.",
    value: "CHÍNH XÁC",
  },
  {
    title: "QUẢN LÝ",
    label: "Mọi thao tác đều được ghi nhận đầy đủ.",
    value: "MINH BẠCH",
  },
  {
    title: "TỐC ĐỘ CẬP NHẬT",
    label: "Thông tin được cập nhật theo thời gian thực.",
    value: "KỊP THỜI",
  },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <aside
        className="relative hidden lg:flex flex-col justify-between p-12 text-primary-foreground overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div
          className="absolute inset-0 opacity-70 mix-blend-overlay pointer-events-none"
          style={{ background: "var(--gradient-mesh)" }}
        />
        <div className="relative h-20 w-20 shrink-0">
          <Image
            src={APP_LOGO}
            alt="Logo"
            fill
            sizes="80px"
            className="object-contain"
            priority
          />
        </div>

        <div className="relative space-y-10">
          <div>
            {/* TÊN PHẦN MỀM - tiêu đề chính của trang. */}
            {/* Tên dài nên để chữ tự xuống dòng theo bề rộng cột, không ép
                từng vế một dòng (màn laptop nhỏ sẽ tràn). */}
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.12] tracking-tight xl:text-5xl">
              {APP_NAME}
            </h1>
            <p className="mt-6 max-w-xl text-white/75">
              Giao việc, theo dõi tiến độ và đánh giá kết quả trên một hệ thống
              nội bộ.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-5xl">
            {stats.map(({ title, label, value }) => (
              <div
                key={title}
                className="rounded-3xl bg-white/10 backdrop-blur-md p-7 ring-1 ring-white/15 min-h-[220px] flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70 mb-4">
                    {title}
                  </div>
                  <div className="font-display text-4xl font-bold leading-tight">
                    {value}
                  </div>
                </div>
                <div className="text-sm text-white/70 mt-4">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-sm text-white/70">
          © <ServerYear />
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          {/* Bản cho màn hẹp (không có cột trái): logo + tên phần mềm. */}
          <div className="lg:hidden mb-10 flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <Image
                src={APP_LOGO}
                alt="Logo"
                fill
                sizes="64px"
                className="object-contain"
              />
            </div>
            <div className="min-w-0 font-display text-lg font-bold leading-tight text-primary">
              {APP_NAME}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-foreground">
              Chào mừng trở lại
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Đăng nhập để tiếp tục.
            </p>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{" "}
            <a href="#" className="font-medium text-primary hover:underline">
              Liên hệ quản trị viên
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
