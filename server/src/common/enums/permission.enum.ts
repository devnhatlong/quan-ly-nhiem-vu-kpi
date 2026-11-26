export enum Permission {
  USER_VIEW = 'user.view',
  USER_MANAGE = 'user.manage',

  DEPARTMENT_VIEW = 'department.view',
  DEPARTMENT_MANAGE = 'department.manage',

  ROLE_ASSIGN = 'role.assign',

  /** Chọn Phó ban phụ trách trợ lý trong Ban. */
  SUPERVISION_MANAGE = 'supervision.manage',

  /** Xem nhiệm vụ trong phạm vi của mình. */
  TASK_VIEW = 'task.view',
  /** Giao nhiệm vụ (Trưởng ban, Phó ban). */
  TASK_ASSIGN = 'task.assign',
  /** Lập bản tự khai gửi lên (Phó ban, trợ lý). */
  TASK_SELF_REPORT = 'task.self_report',
  /** Duyệt / trả lại bản gửi lên (Phó ban bước 1, Trưởng ban chốt). */
  TASK_REVIEW = 'task.review',

  SYSTEM_CONFIG = 'system.config',
}
