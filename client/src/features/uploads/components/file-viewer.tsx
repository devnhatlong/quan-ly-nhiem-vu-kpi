"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileQuestion, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Cách xem theo đuôi tệp. Trình duyệt tự hiển thị được PDF, ảnh, văn bản;
 * Word (.docx) và Excel (.xlsx) dựng bằng thư viện chạy ngay trong trình duyệt
 * (đóng gói sẵn, không cần Internet hay máy chủ chuyển đổi). Đuôi khác: tải về.
 */
type ViewKind = "pdf" | "image" | "text" | "docx" | "xlsx";

const KIND_BY_EXT: Record<string, ViewKind> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  txt: "text",
  csv: "text",
  docx: "docx",
  xlsx: "xlsx",
};

function kindOf(fileName: string): ViewKind | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return KIND_BY_EXT[ext] ?? null;
}

/** Tệp này có xem trực tiếp được không - để ẩn / hiện nút "Xem". */
export function canPreview(fileName: string): boolean {
  return kindOf(fileName) !== null;
}

type ViewerFile = { uploadId: string; name: string };

export function FileViewer({
  file,
  onClose,
}: {
  file: ViewerFile | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      {/* Căn giữa bằng inset-0 + m-auto: transform -50% hay ra nửa pixel làm
          nội dung bên trong bị nhoè. */}
      <DialogContent className="inset-0 m-auto flex h-[92vh] w-[96vw] max-w-[96vw] translate-x-0 translate-y-0 flex-col gap-2 p-3 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:max-w-[96vw]">
        {file ? <ViewerBody key={file.uploadId} file={file} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ViewerBody({ file }: { file: ViewerFile }) {
  const kind = kindOf(file.name);
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    blob: Blob | null;
  }>({ loading: true, error: null, blob: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get<Blob>(`/uploads/${file.uploadId}`, { responseType: "blob" })
      .then((res) => {
        if (!cancelled) setState({ loading: false, error: null, blob: res.data });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            loading: false,
            error: getApiErrorMessage(err, "Không tải được tệp."),
            blob: null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [file.uploadId]);

  const download = () => {
    const save = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    };
    if (state.blob) return save(state.blob);
    api
      .get<Blob>(`/uploads/${file.uploadId}`, { responseType: "blob" })
      .then((res) => save(res.data))
      .catch((err) => toast.error(getApiErrorMessage(err, "Không tải được tệp.")));
  };

  return (
    <>
      <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 pr-8">
        <div className="min-w-0">
          <DialogTitle className="truncate text-base">{file.name}</DialogTitle>
          <DialogDescription className="text-xs">
            Chỉ xem - tệp đính kèm là bản đã nộp, không sửa ở đây.
          </DialogDescription>
        </div>
        <Button type="button" size="sm" variant="outline" className="bg-background" onClick={download}>
          <Download className="size-4" />
          Tải về
        </Button>
      </DialogHeader>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/30">
        {state.loading ? (
          <Centered>
            <Loader2 className="size-5 animate-spin" />
            <span>Đang mở tệp...</span>
          </Centered>
        ) : state.error ? (
          <Centered>
            <span className="text-destructive">{state.error}</span>
          </Centered>
        ) : !kind || !state.blob ? (
          <Unsupported onDownload={download} />
        ) : (
          <Preview kind={kind} blob={state.blob} name={file.name} onDownload={download} />
        )}
      </div>
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Unsupported({ onDownload, reason }: { onDownload: () => void; reason?: string }) {
  return (
    <Centered>
      <FileQuestion className="size-10 opacity-40" />
      <span>{reason ?? "Loại tệp này không xem trực tiếp được trên trình duyệt."}</span>
      <Button type="button" variant="outline" onClick={onDownload}>
        <Download className="size-4" />
        Tải tệp về để xem
      </Button>
    </Centered>
  );
}

/** MIME theo đuôi - blob từ server có thể mang kiểu chung chung. */
const MIME: Partial<Record<ViewKind, string>> = { pdf: "application/pdf" };

/**
 * Gắn blob vào `src` của thẻ qua ref: URL tạm tạo trong effect và thu hồi khi
 * đóng - không cần state, không giữ URL sống sau khi thẻ đã gỡ.
 */
function useBlobSrc<T extends HTMLIFrameElement | HTMLImageElement>(blob: Blob, type?: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const url = URL.createObjectURL(type ? new Blob([blob], { type }) : blob);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob, type]);
  return ref;
}

function Preview({
  kind,
  blob,
  name,
  onDownload,
}: {
  kind: ViewKind;
  blob: Blob;
  name: string;
  onDownload: () => void;
}) {
  switch (kind) {
    case "pdf":
      return <PdfPreview blob={blob} name={name} />;
    case "image":
      return <ImagePreview blob={blob} name={name} />;
    case "text":
      return <TextPreview blob={blob} />;
    case "docx":
      return <DocxPreview blob={blob} onDownload={onDownload} />;
    case "xlsx":
      return <XlsxPreview blob={blob} onDownload={onDownload} />;
  }
}

function PdfPreview({ blob, name }: { blob: Blob; name: string }) {
  const ref = useBlobSrc<HTMLIFrameElement>(blob, MIME.pdf);
  return <iframe ref={ref} title={name} className="size-full border-0 bg-white" />;
}

function ImagePreview({ blob, name }: { blob: Blob; name: string }) {
  const ref = useBlobSrc<HTMLImageElement>(blob);
  return (
    <div className="flex size-full items-center justify-center overflow-auto p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh từ blob, không qua next/image */}
      <img ref={ref} alt={name} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

function TextPreview({ blob }: { blob: Blob }) {
  const [text, setText] = useState("");
  useEffect(() => {
    let cancelled = false;
    void blob.text().then((t) => !cancelled && setText(t));
    return () => {
      cancelled = true;
    };
  }, [blob]);
  return (
    <pre className="size-full overflow-auto whitespace-pre-wrap break-words bg-background p-4 font-mono text-xs leading-relaxed">
      {text}
    </pre>
  );
}

/** Word: docx-preview dựng lại trang (chữ, bảng, ảnh, định dạng cơ bản). */
function DocxPreview({ blob, onDownload }: { blob: Blob; onDownload: () => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelled || !holder.current) return;
        holder.current.innerHTML = "";
        await renderAsync(blob, holder.current, undefined, {
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
          breakPages: true,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (failed) {
    return <Unsupported onDownload={onDownload} reason="Không dựng được nội dung tệp Word này." />;
  }
  return <div ref={holder} className="docx-viewer size-full overflow-auto bg-muted/40" />;
}

type Sheet = { name: string; rows: string[][]; truncated: boolean };

const MAX_ROWS = 1000;
const MAX_COLS = 60;

/** Excel: đọc bằng exceljs, bày từng sheet thành bảng (giá trị hiển thị của ô). */
function XlsxPreview({ blob, onDownload }: { blob: Blob; onDownload: () => void }) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await blob.arrayBuffer());
        const result: Sheet[] = wb.worksheets.map((ws) => {
          const rows: string[][] = [];
          const lastRow = Math.min(ws.rowCount, MAX_ROWS);
          const lastCol = Math.min(ws.columnCount, MAX_COLS);
          for (let r = 1; r <= lastRow; r++) {
            const row = ws.getRow(r);
            const cells: string[] = [];
            for (let c = 1; c <= lastCol; c++) cells.push(row.getCell(c).text ?? "");
            rows.push(cells);
          }
          return {
            name: ws.name,
            rows,
            truncated: ws.rowCount > MAX_ROWS || ws.columnCount > MAX_COLS,
          };
        });
        if (!cancelled) setSheets(result);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (failed) {
    return <Unsupported onDownload={onDownload} reason="Không đọc được tệp Excel này." />;
  }
  if (!sheets) {
    return (
      <Centered>
        <Loader2 className="size-5 animate-spin" />
      </Centered>
    );
  }
  const sheet = sheets[active];
  return (
    <div className="flex size-full flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-auto">
        {sheet && sheet.rows.length ? (
          <table className="border-collapse text-xs">
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r}>
                  <th className="sticky left-0 border bg-muted px-2 py-1 text-right font-normal text-muted-foreground">
                    {r + 1}
                  </th>
                  {row.map((cell, c) => (
                    <td key={c} className="max-w-[320px] whitespace-pre-wrap border px-2 py-1 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Centered>Sheet trống.</Centered>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-t bg-muted/40 p-1">
        {sheets.map((s, i) => (
          <button
            key={s.name}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "shrink-0 rounded px-3 py-1 text-xs",
              i === active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:bg-background/60",
            )}
          >
            {s.name}
          </button>
        ))}
        {sheet?.truncated ? (
          <span className="ml-auto shrink-0 px-2 text-[11px] text-muted-foreground">
            Chỉ hiện {MAX_ROWS} dòng, {MAX_COLS} cột đầu - tải về để xem đủ.
          </span>
        ) : null}
      </div>
    </div>
  );
}
