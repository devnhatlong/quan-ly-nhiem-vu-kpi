import type { Metadata } from "next";

import { TaskDetailView } from "@/features/tasks/components/task-detail-view";

export const metadata: Metadata = {
  title: "Chi tiết nhiệm vụ",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TaskDetailView id={id} />;
}
