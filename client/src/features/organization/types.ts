export type {
  ApiResponse,
  AuthTokens,
  ListQueryParams,
  PaginatedResult,
  PaginationMeta,
} from "@/features/auth/types";

export type AppPermission = {
  _id: string;
  id?: string;
  code: string;
  name: string;
  description?: string;
  module: string;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreatePermissionInput = {
  code: string;
  name: string;
  description?: string;
  module?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdatePermissionInput = {
  code?: string;
  name?: string;
  description?: string;
  module?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type Role = {
  _id: string;
  id?: string;
  code: string;
  name: string;
  slug?: string;
  permissions: string[];
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateRoleInput = {
  code: string;
  name: string;
  permissions?: string[];
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdateRoleInput = {
  name?: string;
  permissions?: string[];
  sortOrder?: number;
  isActive?: boolean;
};

export type Department = {
  _id: string;
  id?: string;
  code: string;
  name: string;
  slug?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateDepartmentInput = {
  code: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdateDepartmentInput = {
  code?: string;
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type ImportDepartmentRow = {
  code: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type ImportDepartmentsResult = {
  summary: {
    total: number;
    created: number;
    skipped: number;
    errors: number;
  };
  results: Array<{
    row: number;
    code: string;
    status: "created" | "skipped" | "error";
    message: string;
  }>;
};

export type RoleAssignment = {
  roleCode: string;
  scopeDepartmentId?: string | null;
};

export type UserAccount = {
  id: string;
  _id?: string;
  username: string;
  fullName?: string;
  email?: string;
  phone?: string;
  position?: string;

  rank?: string;
  departmentId?:
    string | { _id?: string; id?: string; code?: string; name?: string };
  roleAssignments: RoleAssignment[];
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateUserInput = {
  username: string;
  password: string;
  fullName?: string;
  email?: string;
  phone?: string;
  position?: string;

  rank?: string;
  departmentId?: string;
  roleAssignments?: RoleAssignment[];
  isActive?: boolean;
};

export type UpdateUserInput = {
  password?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  position?: string;

  rank?: string;
  departmentId?: string | null;
  roleAssignments?: RoleAssignment[];
  isActive?: boolean;
};

export type ImportUserRow = {
  username: string;
  fullName?: string;
  email?: string;
  phone?: string;
  position?: string;

  rank?: string;
  departmentCode?: string;
  roleCodes?: string;
  isActive?: boolean;
};

export type ImportUsersResult = {
  summary: {
    total: number;
    created: number;
    skipped: number;
    errors: number;
  };
  results: Array<{
    row: number;
    code: string;
    status: "created" | "skipped" | "error";
    message: string;
  }>;
};

export function entityId(
  entity: { _id?: string; id?: string } | string | null | undefined,
): string {
  if (!entity) return "";
  if (typeof entity === "string") return entity;
  return String(entity.id ?? entity._id ?? "");
}
