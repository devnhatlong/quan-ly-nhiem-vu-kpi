"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EVALUATION_LABELS,
  PRIORITY_LABELS,
  TYPE_LABELS,
  approveTask,
  cancelTask,
  personName,
  returnTask,
  type ReturnTarget,
  type Task,
  type TaskEvaluation,
  type TaskPriority,
  type TaskType,
} from "@/features/tasks/api";
import { getApiErrorMessage } from "@/lib/api-client";

type DialogProps = {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

function EnumSelect<T extends string>({
  label,
  value,
  onChange,
  labels,
  placeholder,
}: {
  label: string;
  value: T | "";
  onChange: (v: T) => void;
  labels: Record<T, string>;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label} <span className="text-destructive">*</span>
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(labels) as T[]).map((key) => (
            <SelectItem key={key} value={key}>
              {labels[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Duyệt bước hiện tại. Phó ban (bước 1): đề xuất loại, mức độ (+ đánh giá nếu
 * việc đã xong). Trưởng ban (chốt): giữ nguyên hoặc sửa đề xuất.
 */
export function ApproveDialog(props: DialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {props.open ? <ApproveForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ApproveForm({ task, onOpenChange, onDone }: DialogProps) {
  const final = task.review?.stage === "HEAD";
  const [type, setType] = useState<TaskType | "">(task.proposal?.type ?? "");
  const [priority, setPriority] = useState<TaskPriority | "">(task.proposal?.priority ?? "");
  const [evaluation, setEvaluation] = useState<TaskEvaluation | "">(
    task.proposal?.evaluation ?? "",
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!type || !priority) return toast.error("Vui lòng chọn loại nhiệm vụ và mức độ ưu tiên.");
    if (task.reportedDone && !evaluation) return toast.error("Vui lòng chọn mức đánh giá.");
    setSaving(true);
    try {
      const res = await approveTask(task._id, {
        type,
        priority,
        evaluation: task.reportedDone && evaluation ? evaluation : undefined,
        note: note.trim() || undefined,
      });
      toast.success(res.message);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không duyệt được."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{final ? "Trưởng ban chốt" : "Duyệt bước 1"}</DialogTitle>
        <DialogDescription>
          {final
            ? task.reportedDone
              ? "Chốt xác nhận việc đã hoàn thành. Có thể sửa đề xuất của Phó ban."
              : "Chốt để nhiệm vụ chuyển sang Đang thực hiện. Có thể sửa đề xuất của Phó ban."
            : "Đề xuất loại nhiệm vụ và mức độ; bản sẽ chuyển Trưởng ban chốt."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <EnumSelect label="Loại nhiệm vụ" value={type} onChange={setType} labels={TYPE_LABELS} placeholder="Chọn loại" />
          <EnumSelect label="Mức độ ưu tiên" value={priority} onChange={setPriority} labels={PRIORITY_LABELS} placeholder="Chọn mức độ" />
        </div>
        {task.reportedDone ? (
          <EnumSelect
            label={final ? "Đánh giá kết quả" : "Đề xuất đánh giá"}
            value={evaluation}
            onChange={setEvaluation}
            labels={EVALUATION_LABELS}
            placeholder="Chọn mức đánh giá"
          />
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="approve-note">Ý kiến</Label>
          <Textarea id="approve-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Huỷ
        </Button>
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? "Đang lưu..." : final ? "Chốt" : "Duyệt, chuyển Trưởng ban"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Trả lại - bắt buộc lý do; Trưởng ban chọn về Phó ban hay về người lập (S7). */
export function ReturnDialog(props: DialogProps & { targets: ReturnTarget[] }) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {props.open ? <ReturnForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReturnForm({ task, targets, onOpenChange, onDone }: DialogProps & { targets: ReturnTarget[] }) {
  const [to, setTo] = useState<ReturnTarget>(targets[0] ?? "START");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return toast.error("Vui lòng nhập lý do trả lại.");
    setSaving(true);
    try {
      const res = await returnTask(task._id, reason.trim(), to);
      toast.success(res.message);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không trả lại được."));
    } finally {
      setSaving(false);
    }
  };

  const labels: Record<ReturnTarget, [string, string]> = {
    PREVIOUS: [
      `Về Phó ban ${personName(task.review?.deputyId)}`,
      "Phó ban xem lại rồi duyệt lại, hoặc trả tiếp về người lập",
    ],
    START: [
      `Về người lập ${personName(task.createdById)}`,
      "Người lập sửa và gửi lại từ đầu",
    ],
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Trả lại {task.code}</DialogTitle>
        <DialogDescription>Lý do được gửi kèm thông báo và lưu vào lịch sử.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        {targets.length > 1 ? (
          <RadioGroup value={to} onValueChange={(v) => setTo(v as ReturnTarget)} className="grid gap-2">
            {targets.map((t) => (
              <label
                key={t}
                className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value={t} className="mt-0.5" />
                <span>
                  <span className="block font-medium">{labels[t][0]}</span>
                  <span className="block text-xs text-muted-foreground">{labels[t][1]}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
        ) : (
          <p className="text-sm text-muted-foreground">{labels[to][0]}.</p>
        )}
        <div className="space-y-2">
          <Label htmlFor="return-reason">
            Lý do <span className="text-destructive">*</span>
          </Label>
          <Textarea id="return-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Huỷ
        </Button>
        <Button variant="destructive" onClick={() => void submit()} disabled={saving}>
          {saving ? "Đang gửi..." : "Trả lại"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Huỷ - không bao giờ xoá; bắt buộc lý do (C8). */
export function CancelDialog(props: DialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {props.open ? <CancelForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CancelForm({ task, onOpenChange, onDone }: DialogProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return toast.error("Vui lòng nhập lý do huỷ.");
    setSaving(true);
    try {
      const res = await cancelTask(task._id, reason.trim());
      toast.success(res.message);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không huỷ được."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Huỷ {task.code ?? "bản nháp"}</DialogTitle>
        <DialogDescription>
          Nhiệm vụ không bị xoá: vẫn còn trong danh sách với trạng thái Đã huỷ,
          kèm lý do và lịch sử.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="cancel-reason">
          Lý do <span className="text-destructive">*</span>
        </Label>
        <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Quay lại
        </Button>
        <Button variant="destructive" onClick={() => void submit()} disabled={saving}>
          {saving ? "Đang huỷ..." : "Huỷ nhiệm vụ"}
        </Button>
      </DialogFooter>
    </>
  );
}
