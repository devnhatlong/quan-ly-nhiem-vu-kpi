import type { Metadata } from "next";

import { SupervisionView } from "@/features/supervision/components/supervision-view";

export const metadata: Metadata = {
  title: "Phân công phụ trách",
};

export default function SupervisionPage() {
  return <SupervisionView />;
}
