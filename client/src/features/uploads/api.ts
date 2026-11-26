import { api } from "@/lib/api-client";

type ApiEnvelope<T> = { message: string; data: T };

/** Con trỏ tới một tệp đã tải lên - khớp `UploadRef` bên server. */
export type Attachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  /** Độ mật chọn lúc tải lên. */
  classification?: string;
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Bộ lọc của hộp thoại chọn tệp.
 * Phải khớp ALLOWED_UPLOAD_EXTENSIONS bên server - server mới là nơi quyết
 * định, danh sách này chỉ để người dùng khỏi chọn nhầm rồi bị từ chối.
 */
export const ACCEPT_UPLOAD =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar,.7z";

/**
 * Độ mật của tài liệu kiểm chứng - phải khớp DOCUMENT_CLASSIFICATIONS bên
 * server.
 */
export const DOCUMENT_CLASSIFICATIONS = [
  { value: "THUONG", label: "Thường" },
  { value: "MAT", label: "Mật" },
  { value: "TOI_MAT", label: "Tối mật" },
  { value: "TUYET_MAT", label: "Tuyệt mật" },
] as const;

export type DocumentClassification =
  (typeof DOCUMENT_CLASSIFICATIONS)[number]["value"];

/** Nhãn tiếng Việt của độ mật; giá trị lạ/không có thì null. */
export function classificationLabel(value?: string | null): string | null {
  return (
    DOCUMENT_CLASSIFICATIONS.find((item) => item.value === value)?.label ??
    null
  );
}

/**
 * Tải một tệp lên, trả về bản ghi để gắn vào nơi cần dùng.
 * Không đặt Content-Type - để trình duyệt tự sinh boundary cho multipart.
 *
 * `onProgress` nhận phần trăm thật từ axios, không phải thanh chạy giả.
 */
export async function uploadFile(
  file: File,
  classification: DocumentClassification,
  onProgress?: (percent: number) => void,
): Promise<Attachment> {
  const form = new FormData();
  // Trường chữ đặt trước tệp để multer đọc được ngay khi gặp tệp.
  form.append("classification", classification);
  form.append("file", file);

  const { data } = await api.post<ApiEnvelope<Attachment>>(
    "/uploads",
    form,
    {
      headers: { "Content-Type": undefined },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    },
  );
  return data.data;
}

/**
 * Tải tệp về. Endpoint cần Bearer token nên không mở thẳng bằng thẻ <a>;
 * phải lấy blob rồi mới cho trình duyệt lưu.
 */
export async function downloadAttachment(item: Attachment) {
  const response = await api.get<Blob>(`/uploads/${item.id}`, {
    responseType: "blob",
  });

  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = item.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
