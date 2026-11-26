import type { Metadata } from "next";

import { TasksView } from "@/features/tasks/components/tasks-view";

export const metadata: Metadata = {
  title: "Giao nhiệm vụ",
};

export default function TasksPage() {
  return <TasksView />;
}
