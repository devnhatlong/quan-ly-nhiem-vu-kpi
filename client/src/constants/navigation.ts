import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Gauge,
  KeyRound,
  Network,
  Settings,
  Shield,
  UserCog,
  Users,
} from "lucide-react";

import { APP_LOGO, APP_NAME } from "@/constants/app";
import { PERM } from "@/constants/permissions";

export type NavSubItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Nếu có: chỉ hiện khi user có ít nhất một trong các quyền này. */
  permissions?: string[];
  /** Nếu có: phải giữ thêm một trong các vai trò này mới hiện. */
  roles?: string[];
  /** Có một quyền trong đây thì bỏ qua `roles` - xem `NavItem`. */
  rolesExemptPermissions?: string[];
};

export type NavItem = {
  title: string;
  href?: string;
  icon: LucideIcon;
  children?: NavSubItem[];
  /**
   * Nếu có: chỉ hiện khi user có ít nhất một trong các quyền này.
   * Nhóm menu bỏ trống thì hiện khi còn ít nhất một mục con hiện được.
   */
  permissions?: string[];
  /**
   * Nếu có: phải giữ thêm một trong các vai trò này mới hiện - TRỪ KHI user có
   * một quyền trong `rolesExemptPermissions`.
   */
  roles?: string[];
  rolesExemptPermissions?: string[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Tổng quan",
    href: "/dashboard",
    icon: Gauge,
  },
  {
    title: "Giao nhiệm vụ",
    href: "/tasks",
    icon: ClipboardList,
    permissions: [PERM.TASK_VIEW],
  },
  {
    title: "Tổ chức",
    icon: Network,
    // Không đặt quyền ở nhóm: mỗi mục con tự quyết, nhóm hiện khi còn mục nào.
    children: [
      {
        title: "Đơn vị",
        href: "/organization/units",
        icon: Network,
        permissions: [PERM.DEPARTMENT_VIEW],
      },
      {
        title: "Vai trò",
        href: "/organization/roles",
        icon: Shield,
        permissions: [PERM.ROLE_ASSIGN],
      },
      {
        // Danh sách quyền đọc bằng role.assign; sửa mới cần system.config.
        // Gán theo quyền đọc để menu không hiện ra trang load lên là 403.
        title: "Quyền",
        href: "/organization/permissions",
        icon: KeyRound,
        permissions: [PERM.ROLE_ASSIGN],
      },
      {
        title: "Người dùng",
        href: "/organization/employees",
        icon: Users,
        permissions: [PERM.USER_VIEW],
      },
      {
        // Phó ban nào phụ trách trợ lý nào - phạm vi quản lý của Phó ban.
        title: "Phân công phụ trách",
        href: "/organization/supervision",
        icon: UserCog,
        permissions: [PERM.SUPERVISION_MANAGE],
      },
    ],
  },
  {
    // Hồ sơ + đổi mật khẩu của CHÍNH người dùng, không phải cấu hình hệ thống.
    // Ai đăng nhập cũng phải vào được, nên không gắn quyền.
    title: "Cài đặt",
    href: "/settings",
    icon: Settings,
  },
];

/** Đường không nằm trong menu nhưng vẫn phải chặn. */
const EXTRA_PATH_PERMISSIONS: Record<string, string[]> = {};

/**
 * Bảng đường dẫn → quyền, dựng thẳng từ NAV_ITEMS để menu và guard không bao
 * giờ lệch nhau. Mục con không khai quyền thì thừa hưởng của nhóm.
 */
const PATH_PERMISSIONS: Array<[string, string[]]> = (() => {
  const entries: Array<[string, string[]]> = [];

  for (const item of NAV_ITEMS) {
    if (item.href && item.permissions?.length) {
      entries.push([item.href, item.permissions]);
    }
    for (const child of item.children ?? []) {
      const permissions = child.permissions?.length
        ? child.permissions
        : item.permissions;
      if (permissions?.length) entries.push([child.href, permissions]);
    }
  }

  for (const [href, permissions] of Object.entries(EXTRA_PATH_PERMISSIONS)) {
    entries.push([href, permissions]);
  }

  // Khớp đường dài trước, để đường con không bị đường cha nuốt.
  return entries.sort((a, b) => b[0].length - a[0].length);
})();

/** Quyền cần có để vào một path, null nghĩa là ai đăng nhập cũng vào được. */
export function pathRequiresPermissions(
  pathname: string,
): readonly string[] | null {
  const hit = PATH_PERMISSIONS.find(
    ([href]) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return hit ? hit[1] : null;
}

export const SIDEBAR_BRAND = {
  title: APP_NAME,
  /** Tên trên sidebar ngắt đúng chỗ - cạnh logo chỉ còn ~168px. */
  subtitleLines: ["Quản lý, điều hành", "& đánh giá nhiệm vụ"],
  logo: APP_LOGO,
} as const;
