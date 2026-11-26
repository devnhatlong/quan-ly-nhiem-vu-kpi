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

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <aside
        className="relative hidden lg:flex flex-col p-12 text-primary-foreground overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div
          className="absolute inset-0 opacity-70 mix-blend-overlay pointer-events-none"
          style={{ background: "var(--gradient-mesh)" }}
        />
        {/* Logo to ở giữa, tên phần mềm chữ trắng bên dưới. */}
        <div className="relative flex flex-1 flex-col items-center justify-center text-center">
          <div className="relative size-48 shrink-0 drop-shadow-2xl xl:size-56">
            <Image
              src={APP_LOGO}
              alt="Logo"
              fill
              sizes="224px"
              className="object-contain"
              priority
            />
          </div>
          {/* TÊN PHẦN MỀM - tiêu đề chính của trang; chữ tự xuống dòng theo
              bề rộng cột. */}
          <h1 className="mt-10 max-w-2xl font-display text-3xl font-bold leading-snug tracking-tight text-white [text-wrap:balance] xl:text-4xl">
            {APP_NAME}
          </h1>
        </div>

        <div className="relative text-center text-sm text-white/70">
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
