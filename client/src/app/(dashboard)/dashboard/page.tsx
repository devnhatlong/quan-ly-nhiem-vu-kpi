import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Tổng quan",
};

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="Tổng quan"
      description="Chưa có nội dung - chờ xây dựng nghiệp vụ mới."
    />
  );
}
