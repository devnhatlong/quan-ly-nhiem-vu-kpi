"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { MultiSelect } from "@/components/common/multi-select";
import { SearchableSelect } from "@/components/common/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchPickPeople,
  forwardTask,
  handlerOf,
  isForwarded,
  markPartDone,
  partDoneOf,
  personName,
  personTag,
  recallTask,
  reportDone,
  taskKeys,
  updateProgress,
  type Task,
  type TaskAttachment,
} from "@/features/tasks/api";
import { AttachmentsField } from "@/features/tasks/components/attachments-field";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type DialogProps = {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

const QUICK = [0, 25, 50, 75, 100];

function Required() {
  return <span className="text-destructive">*</span>;
}

// ------------------------------------------------------------ tiến độ

/** Người xử lý chính cập nhật % và ghi nội dung đã làm (C1). */
export function ProgressDialog(props: DialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="overflow-x-hidden sm:max-w-xl">
        {props.open ? <ProgressForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ProgressForm({ task, onOpenChange, onDone }: DialogProps) {
  const [value, setValue] = useState(task.progress);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<TaskAttachment[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!note.trim()) return toast.error("Vui lòng ghi nội dung đã làm.");
    setSaving(true);
    try {
      const res = await updateProgress(task._id, {
        progress: value,
        note: note.trim(),
        attachmentIds: files.map((f) => f.id),
      });
      toast.success(res.message);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không cập nhật được tiến độ."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Cập nhật tiến độ</DialogTitle>
        <DialogDescription>
          Đang ở {task.progress}%. Nội dung cập nhật hiện trên dòng thời gian của nhiệm vụ.
        </DialogDescription>
      </DialogHeader>
      <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
        <div className="space-y-3">
          <Label>
            Tiến độ <Required />
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK.map((q) => (
              <Button
                key={q}
                type="button"
                size="sm"
                variant={value === q ? "default" : "outline"}
                className={cn("min-w-14 tabular-nums", value !== q && "bg-background")}
                onClick={() => setValue(q)}
              >
                {q}%
              </Button>
            ))}
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                aria-label="Nhập số phần trăm"
                className="w-20 tabular-nums"
                value={value}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  setValue(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
                }}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <Progress value={value} className="h-2" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="progress-note">
            Nội dung đã làm <Required />
          </Label>
          <Textarea
            id="progress-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Đã tổng hợp xong số liệu 3 phòng, đang viết phần đánh giá."
          />
        </div>
        <div className="space-y-2">
          <Label>Tài liệu kèm theo</Label>
          <AttachmentsField value={files} onChange={setFiles} disabled={saving} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Huỷ
        </Button>
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? "Đang lưu..." : "Cập nhật"}
        </Button>
      </DialogFooter>
    </>
  );
}

// --------------------------------------------------------- báo hoàn thành

/** Người xử lý chính báo cáo hoàn thành → chờ xác nhận (C2). */
export function ReportDialog(props: DialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="overflow-x-hidden sm:max-w-xl">
        {props.open ? <ReportForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReportForm({ task, onOpenChange, onDone }: DialogProps) {
  const [result, setResult] = useState(task.result ?? "");
  const [files, setFiles] = useState<TaskAttachment[]>(task.resultAttachments ?? []);
  const [saving, setSaving] = useState(false);
  const pending = task.collaboratorIds.filter((p) => !partDoneOf(task, p._id));

  const submit = async () => {
    if (!result.trim()) return toast.error("Vui lòng ghi kết quả thực hiện.");
    setSaving(true);
    try {
      const res = await reportDone(task._id, {
        result: result.trim(),
        attachmentIds: files.map((f) => f.id),
      });
      toast.success(res.message);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không báo cáo được."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Báo cáo hoàn thành</DialogTitle>
        <DialogDescription>
          Nhiệm vụ chuyển sang Chờ xác nhận. Cấp trên xác nhận và đánh giá, hoặc trả lại
          để làm tiếp.
        </DialogDescription>
      </DialogHeader>
      <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
        {pending.length ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="font-semibold">Người phối hợp chưa đánh dấu xong:</span>{" "}
            {pending.map((p) => personName(p)).join(", ")}. Vẫn gửi báo cáo được.
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="report-result">
            Kết quả thực hiện <Required />
          </Label>
          <Textarea
            id="report-result"
            rows={4}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="VD: Đã ban hành Báo cáo số 20/BC ngày 25/11."
          />
        </div>
        <div className="space-y-2">
          <Label>Văn bản, sản phẩm kèm theo</Label>
          <AttachmentsField value={files} onChange={setFiles} disabled={saving} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Huỷ
        </Button>
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? "Đang gửi..." : "Gửi báo cáo"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------- phối hợp xong phần việc

/** Người phối hợp đánh dấu xong phần việc của mình - không đóng nhiệm vụ. */
export function PartDoneDialog(props: DialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="overflow-x-hidden sm:max-w-xl">
        {props.open ? <PartDoneForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PartDoneForm({ task, onOpenChange, onDone }: DialogProps) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<TaskAttachment[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await markPartDone(task._id, {
        note: note.trim() || undefined,
        attachmentIds: files.map((f) => f.id),
      });
      toast.success(res.message);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không đánh dấu được."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Xong phần việc phối hợp</DialogTitle>
        <DialogDescription>
          Chỉ đánh dấu phần việc của bạn đã xong. Nhiệm vụ vẫn đang thực hiện cho tới khi{" "}
          {personName(handlerOf(task))} báo cáo hoàn thành.
        </DialogDescription>
      </DialogHeader>
      <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
        <div className="space-y-2">
          <Label htmlFor="part-note">Kết quả phần việc</Label>
          <Textarea
            id="part-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Đã gửi số liệu phần phối hợp."
          />
        </div>
        <div className="space-y-2">
          <Label>Tài liệu kèm theo</Label>
          <AttachmentsField value={files} onChange={setFiles} disabled={saving} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Huỷ
        </Button>
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? "Đang lưu..." : "Đánh dấu xong"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ------------------------------------------------------------ chuyển tiếp

/** Phó ban chủ trì chuyển cho trợ lý mình phụ trách xử lý chính. */
export function ForwardDialog(props: DialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="overflow-x-hidden sm:max-w-lg">
        {props.open ? <ForwardForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ForwardForm({ task, onOpenChange, onDone }: DialogProps) {
  const { data: people = [], isLoading } = useSWR(taskKeys.people("forward"), () =>
    fetchPickPeople("forward"),
  );
  const current = handlerOf(task)._id;
  const allOptions = useMemo(
    () =>
      people.map((p) => ({ value: p.id, label: p.name, keywords: p.username, tag: personTag(p) })),
    [people],
  );
  const options = allOptions.filter((o) => o.value !== current);
  const [handlerId, setHandlerId] = useState("");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  // Người phối hợp cấp trên đã giao vẫn giữ nguyên; ở đây chỉ thêm người.
  const assigned = task.collaboratorIds.filter((p) => p._id !== handlerId);
  const assignedIds = new Set(task.collaboratorIds.map((p) => p._id));
  const collaboratorOptions = allOptions.filter(
    (o) => o.value !== handlerId && !assignedIds.has(o.value),
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!handlerId) return toast.error("Vui lòng chọn người xử lý chính.");
    setSaving(true);
    try {
      const res = await forwardTask(task._id, {
        handlerId,
        collaboratorIds: collaboratorIds.filter((c) => c !== handlerId),
        note: note.trim() || undefined,
      });
      toast.success(res.message);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không chuyển tiếp được."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Chuyển tiếp xử lý</DialogTitle>
        <DialogDescription>
          Người được chọn thành người xử lý chính: cập nhật tiến độ và báo cáo hoàn thành.
          Bạn vẫn là chủ trì, vẫn theo dõi, cho ý kiến và thu hồi được.
          {isForwarded(task) ? ` Đang xử lý: ${personName(handlerOf(task))}.` : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
        <div className="space-y-2">
          <Label>
            Người xử lý chính <Required />
          </Label>
          <SearchableSelect
            value={handlerId}
            onValueChange={(v) => {
              setHandlerId(v);
              setCollaboratorIds((prev) => prev.filter((c) => c !== v));
            }}
            options={options}
            placeholder={
              isLoading
                ? "Đang tải..."
                : options.length
                  ? "Chọn trợ lý"
                  : "Chưa có trợ lý nào trong phạm vi phụ trách"
            }
            searchPlaceholder="Tìm theo tên..."
          />
        </div>
        <div className="space-y-2">
          <Label>Người phối hợp</Label>
          <MultiSelect
            value={collaboratorIds}
            onValueChange={setCollaboratorIds}
            options={collaboratorOptions}
            placeholder="Chọn người phối hợp (nếu có)"
            searchPlaceholder="Tìm theo tên..."
          />
          {assigned.length ? (
            <p className="text-xs text-muted-foreground">
              Đang phối hợp (giữ nguyên): {assigned.map((p) => personName(p)).join(", ")}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="forward-note">Chỉ đạo, ghi chú</Label>
          <Textarea id="forward-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Huỷ
        </Button>
        <Button onClick={() => void submit()} disabled={saving || !handlerId}>
          {saving ? "Đang chuyển..." : "Chuyển tiếp"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------- thu hồi

export function RecallDialog(props: DialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {props.open ? <RecallForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RecallForm({ task, onOpenChange, onDone }: DialogProps) {
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const res = await recallTask(task._id);
      toast.success(res.message);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không thu hồi được."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>Thu hồi nhiệm vụ</DialogTitle>
        <DialogDescription>
          {personName(handlerOf(task))} không còn là người xử lý chính (vẫn xem và cho ý kiến
          được). Bạn trực tiếp cập nhật tiến độ và báo cáo hoàn thành, hoặc chuyển tiếp cho
          người khác.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Quay lại
        </Button>
        <Button variant="destructive" onClick={() => void submit()} disabled={saving}>
          {saving ? "Đang thu hồi..." : "Thu hồi"}
        </Button>
      </DialogFooter>
    </>
  );
}
