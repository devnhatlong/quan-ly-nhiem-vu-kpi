"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { DatePickerInput } from "@/components/common/date-picker-input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AttachmentsField } from "@/features/tasks/components/attachments-field";
import {
  PRIORITY_LABELS,
  TYPE_LABELS,
  createAssignedTask,
  fetchPickPeople,
  personTag,
  taskKeys,
  updateAssignedTask,
  type Task,
  type TaskAttachment,
  type TaskPriority,
  type TaskType,
} from "@/features/tasks/api";
import { getApiErrorMessage } from "@/lib/api-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Có = sửa nhiệm vụ này; không = giao mới. */
  edit?: Task | null;
  onSaved: (id: string) => void;
};

export function AssignTaskDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto overflow-x-hidden sm:max-w-3xl">
        {/* Dựng lại form mỗi lần mở - trạng thái lấy thẳng từ `edit`. */}
        {props.open ? <AssignForm key={props.edit?._id ?? "new"} {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AssignForm({ onOpenChange, edit, onSaved }: Props) {
  const { data: people = [] } = useSWR(taskKeys.people("assign"), () =>
    fetchPickPeople("assign"),
  );

  const [content, setContent] = useState(edit?.content ?? "");
  const [basis, setBasis] = useState(edit?.basis ?? "");
  const [type, setType] = useState<TaskType>(edit?.type ?? "REGULAR");
  const [priority, setPriority] = useState<TaskPriority>(edit?.priority ?? "NORMAL");
  const [ownerId, setOwnerId] = useState(edit?.ownerId._id ?? "");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(
    edit?.collaboratorIds.map((p) => p._id) ?? [],
  );
  const [startDate, setStartDate] = useState(edit?.startDate ?? "");
  const [dueDate, setDueDate] = useState(edit?.dueDate ?? "");
  const [attachments, setAttachments] = useState<TaskAttachment[]>(edit?.attachments ?? []);
  const [saving, setSaving] = useState(false);

  const personOptions = useMemo(
    () =>
      people.map((p) => ({
        value: p.id,
        label: p.name,
        keywords: p.username,
        tag: personTag(p),
      })),
    [people],
  );

  const submit = async () => {
    if (!content.trim()) return toast.error("Vui lòng nhập nội dung nhiệm vụ.");
    if (!ownerId) return toast.error("Vui lòng chọn người chủ trì.");
    if (!dueDate) return toast.error("Vui lòng chọn hạn hoàn thành.");
    const payload = {
      content: content.trim(),
      basis: basis.trim(),
      type,
      priority,
      ownerId,
      collaboratorIds: collaboratorIds.filter((id) => id !== ownerId),
      startDate: startDate || undefined,
      dueDate,
      attachmentIds: attachments.map((a) => a.id),
    };
    setSaving(true);
    try {
      const res = edit
        ? await updateAssignedTask(edit._id, { ...payload, startDate: startDate || "" })
        : await createAssignedTask(payload);
      toast.success(res.message);
      onOpenChange(false);
      onSaved(edit?._id ?? res.data?.id ?? "");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không lưu được nhiệm vụ."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{edit ? `Sửa nhiệm vụ ${edit.code ?? ""}` : "Giao nhiệm vụ"}</DialogTitle>
        <DialogDescription>
          {edit
            ? "Mọi thay đổi đều được ghi vào lịch sử nhiệm vụ."
            : "Người chủ trì và người phối hợp nhận thông báo ngay khi giao."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-w-0 gap-4 py-1 [&>*]:min-w-0">
        <div className="space-y-2">
          <Label htmlFor="task-content">
            Nội dung <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="task-content"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="VD: Xây dựng báo cáo tổng kết công tác năm 2026"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-basis">Căn cứ</Label>
          <Input
            id="task-basis"
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            placeholder="Kế hoạch, công văn, ý kiến chỉ huy..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Loại nhiệm vụ</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as TaskType[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {TYPE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mức độ ưu tiên</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {PRIORITY_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            Chủ trì <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            value={ownerId}
            onValueChange={(v) => {
              setOwnerId(v);
              setCollaboratorIds((prev) => prev.filter((id) => id !== v));
            }}
            options={personOptions}
            placeholder={people.length ? "Chọn người chủ trì" : "Không có người để giao"}
            searchPlaceholder="Tìm theo tên..."
          />
        </div>

        <div className="space-y-2">
          <Label>Phối hợp</Label>
          <MultiSelect
            value={collaboratorIds}
            onValueChange={setCollaboratorIds}
            options={personOptions.filter((o) => o.value !== ownerId)}
            placeholder="Chọn người phối hợp (nếu có)"
            searchPlaceholder="Tìm theo tên..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Ngày bắt đầu</Label>
            <DatePickerInput value={startDate} onChange={setStartDate} max={dueDate || undefined} />
          </div>
          <div className="space-y-2">
            <Label>
              Hạn hoàn thành <span className="text-destructive">*</span>
            </Label>
            <DatePickerInput
              value={dueDate}
              onChange={setDueDate}
              min={startDate || undefined}
              clearable={false}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tài liệu đính kèm</Label>
          <AttachmentsField value={attachments} onChange={setAttachments} disabled={saving} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Huỷ
        </Button>
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? "Đang lưu..." : edit ? "Lưu thay đổi" : "Giao nhiệm vụ"}
        </Button>
      </DialogFooter>
    </>
  );
}
