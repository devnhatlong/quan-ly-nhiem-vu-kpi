import type { ApiResponse } from "@/features/auth/types";
import { api, unwrapData } from "@/lib/api-client";

export type SupervisionMember = {
  id: string;
  username: string;
  fullName: string;
  rank: string;
  position: string;
};

export type SupervisionAssistant = SupervisionMember & {
  /** Phó ban phụ trách; null = Trưởng ban trực tiếp. */
  supervisorId: string | null;
};

export type SupervisionOverview = {
  /** Các Ban người đang xem được chỉnh phân công. */
  departments: Array<{ id: string; code: string; name: string }>;
  department: { id: string; code: string; name: string } | null;
  heads: SupervisionMember[];
  deputies: SupervisionMember[];
  assistants: SupervisionAssistant[];
};

export const supervisionKeys = {
  overview: (departmentId: string) =>
    ["supervision", departmentId || "default"] as const,
};

export function fetchSupervision(departmentId?: string) {
  return unwrapData(
    api.get<ApiResponse<SupervisionOverview>>("/supervision", {
      params: departmentId ? { departmentId } : {},
    }),
  );
}

/**
 * Đặt đúng danh sách trợ lý của một Phó ban. Trợ lý đang thuộc Phó ban khác
 * thì chuyển sang; trợ lý bị bỏ khỏi danh sách thì về Trưởng ban trực tiếp.
 */
export function setDeputyAssistants(deputyId: string, assistantIds: string[]) {
  return unwrapData(
    api.put<ApiResponse<{ deputyId: string; assistantIds: string[] }>>(
      `/supervision/deputies/${deputyId}/assistants`,
      { assistantIds },
    ),
  );
}

/** "Đại úy Hoàng Thu Trang" - cấp bậc và họ tên đọc liền một cụm xưng hô. */
export function memberLabel(member: SupervisionMember): string {
  return member.rank ? `${member.rank} ${member.fullName}` : member.fullName;
}
