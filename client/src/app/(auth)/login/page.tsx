import type { Metadata } from "next";
import Image from "next/image";
import { APP_NAME, ORG_NAME } from "@/constants/app";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = {
  // Khuôn ở layout gốc tự nối tên phần mềm.
  title: "Đăng nhập",
  description: `Đăng nhập vào ${APP_NAME}.`,
  openGraph: {
    title: `Đăng nhập - ${APP_NAME}`,
    description: `${APP_NAME} - ${ORG_NAME}.`,
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
        {/* Đơn vị chủ quản: dòng nhỏ cạnh logo - nhường chỗ to nhất cho tên
            phần mềm ở dưới. */}
        <div className="relative flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0">
            <Image
              src="/icons/logo_cand.png"
              alt="Logo Công an"
              fill
              sizes="56px"
              className="object-contain"
            />
          </div>
          <div className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-300">
            {ORG_NAME}
          </div>
        </div>

        <div className="relative space-y-10">
          <div>
            {/* TÊN PHẦN MỀM - tiêu đề chính của trang. */}
            {/* Hai vế CÙNG CỠ - đọc liền một tên, chỉ khác màu. Tên dài nên
                để chữ tự xuống dòng theo bề rộng cột, không ép từng vế một
                dòng (màn laptop nhỏ sẽ tràn). */}
            <h1 className="font-display text-5xl font-bold leading-[1.08] tracking-tight xl:text-6xl">
              <span className="block">{APP_NAME}</span>
              <span className="block text-yellow-100">{ORG_NAME}</span>
            </h1>
            <p className="mt-6 max-w-xl text-white/75">
              Hệ thống nội bộ dành cho cán bộ, chiến sĩ {ORG_NAME}.
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
          © {new Date().getFullYear()} {ORG_NAME}.
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          {/* Bản cho màn hẹp (không có cột trái): tên phần mềm vẫn là chữ to
              nhất, đơn vị chủ quản là dòng nhỏ phía trên. */}
          <div className="lg:hidden mb-10 flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <Image
                src="/icons/logo_cand.png"
                alt="Logo Công an"
                fill
                sizes="64px"
                className="object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {ORG_NAME}
              </div>
              <div className="font-display text-xl font-bold leading-tight text-primary">
                {APP_NAME}
              </div>
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
