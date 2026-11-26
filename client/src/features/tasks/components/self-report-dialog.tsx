"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { DatePickerInput } from "@/components/common/date-picker-input";
import { MultiSelect } from "@/components/common/multi-select";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentsField } from "@/features/tasks/components/attachments-field";
import {
  createSelfReport,
  fetchPickPeople,
  personTag,
  taskKeys,
  updateSelfReport,
  type Task,
  type TaskAttachment,
} from "@/features/tasks/api";
import { getApiErrorMessage } from "@/lib/api-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Có = sửa bản nháp / bị trả lại; không = lập mới. */
  edit?: Task | null;
  onSaved: (id: string) => void;
};

export function SelfReportDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto overflow-x-hidden sm:max-w-3xl">
        {props.open ? <SelfReportForm key={props.edit?._id ?? "new"} {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SelfReportForm({ onOpenChange, edit, onSaved }: Props) {
  const { data: people = [] } = useSWR(taskKeys.people("self-report"), () =>
    fetchPickPeople("self-report"),
  );

  const [content, setContent] = useState(edit?.content ?? "");
  const [basis, setBasis] = useState(edit?.basis ?? "");
  const [done, setDone] = useState(edit?.reportedDone ?? false);
  const [result, setResult] = useState(edit?.result ?? "");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(
    edit?.collaboratorIds.map((p) => p._id) ?? [],
  );
  const [startDate, setStartDate] = useState(edit?.startDate ?? "");
  const [dueDate, setDueDate] = useState(edit?.dueDate ?? "");
  const [attachments, setAttachments] = useState<TaskAttachment[]>(edit?.attachments ?? []);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);

  const options = useMemo(
    () =>
      people.map((p) => ({
        value: p.id,
        label: p.name,
        keywords: p.username,
        tag: personTag(p),
      })),
    [people],
  );

  const save = async (submit: boolean) => {
    if (submit) {
      if (!content.trim()) return toast.error("Vui lòng nhập nội dung.");
      if (done && !result.trim()) return toast.error("Việc đã làm xong cần ghi kết quả.");
      if (!done && !dueDate) return toast.error("Việc đang thực hiện cần có hạn hoàn thành.");
    }
    const payload = {
      content: content.trim(),
      basis: basis.trim(),
      reportedDone: done,
      result: result.trim(),
      collaboratorIds,
      startDate: startDate || "",
      dueDate: dueDate || "",
      attachmentIds: attachments.map((a) => a.id),
      submit,
    };
    setSaving(submit ? "submit" : "draft");
    try {
      const res = edit
        ? await updateSelfReport(edit._id, payload)
        : await createSelfReport({
            ...payload,
            startDate: startDate || undefined,
            dueDate: dueDate || undefined,
          });
      toast.success(res.message);
      onOpenChange(false);
      onSaved(edit?._id ?? res.data?.id ?? "");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không lưu được."));
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{edit ? "Sửa bản tự khai" : "Tự khai nhiệm vụ"}</DialogTitle>
        <DialogDescription>
          Khai nhiệm vụ phát sinh hoặc việc đã làm. Bản gửi lên Phó ban phụ trách
          (nếu có) rồi Trưởng ban chốt; chỉ được tính thống kê, KPI sau khi chốt.
          Loại nhiệm vụ và mức độ do người duyệt xác định.
        </DialogDescription>
      </DialogHeader>

      {edit?.lastReturn && edit.status === "RETURNED" ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <span className="font-medium">Lý do trả lại:</span> {edit.lastReturn.reason}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 py-1 [&>*]:min-w-0">
        <div className="space-y-2">
          <Label htmlFor="sr-content">
            Nội dung <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="sr-content"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="VD: Soạn công văn trả lời Phòng Tổ chức"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sr-basis">Căn cứ</Label>
          <Input
            id="sr-basis"
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            placeholder="Kế hoạch, công văn, ý kiến chỉ huy..."
          />
        </div>

        <div className="space-y-2">
          <Label>Tình trạng</Label>
          <RadioGroup
            value={done ? "done" : "doing"}
            onValueChange={(v) => setDone(v === "done")}
            className="grid gap-2 sm:grid-cols-2"
          >
            {[
              ["doing", "Đang thực hiện", "Việc phát sinh chưa xong - sau khi chốt sẽ theo dõi tiến độ"],
              ["done", "Đã làm xong", "Việc đã hoàn thành - chốt là ghi nhận hoàn thành luôn"],
            ].map(([value, label, hint]) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value={value} className="mt-0.5" />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        {done ? (
          <div className="space-y-2">
            <Label htmlFor="sr-result">
              Kết quả <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="sr-result"
              rows={3}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="VD: Đã ban hành Công văn số 15/CV ngày 25/11/2026"
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Ngày bắt đầu</Label>
            <DatePickerInput value={startDate} onChange={setStartDate} max={dueDate || undefined} />
          </div>
          <div className="space-y-2">
            <Label>
              {done ? "Hạn hoàn thành" : "Hạn hoàn thành"}
              {done ? null : <span className="text-destructive"> *</span>}
            </Label>
            <DatePickerInput value={dueDate} onChange={setDueDate} min={startDate || undefined} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Phối hợp</Label>
          <MultiSelect
            value={collaboratorIds}
            onValueChange={setCollaboratorIds}
            options={options}
            placeholder="Chọn người phối hợp (nếu có)"
            searchPlaceholder="Tìm theo tên..."
          />
        </div>

        <div className="space-y-2">
          <Label>Tài liệu, sản phẩm đính kèm</Label>
          <AttachmentsField value={attachments} onChange={setAttachments} disabled={saving !== null} />
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving !== null}>
          Huỷ
        </Button>
        <Button variant="secondary" onClick={() => void save(false)} disabled={saving !== null}>
          {saving === "draft" ? "Đang lưu..." : "Lưu nháp"}
        </Button>
        <Button onClick={() => void save(true)} disabled={saving !== null}>
          {saving === "submit" ? "Đang gửi..." : "Gửi duyệt"}
        </Button>
      </DialogFooter>
    </>
  );
}
