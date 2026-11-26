"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createDepartment,
  updateDepartment,
} from "@/features/organization/api";
import type {
  CreateDepartmentInput,
  Department,
} from "@/features/organization/types";
import { entityId } from "@/features/organization/types";
import { getApiErrorMessage } from "@/lib/api-client";

type UnitFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edit?: Department | null;
  onSuccess: () => void;
};

export function UnitFormDialog({
  open,
  onOpenChange,
  edit,
  onSuccess,
}: UnitFormDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setCode(edit.code);
      setName(edit.name);
      setSortOrder(String(edit.sortOrder ?? 0));
      setIsActive(edit.isActive);
    } else {
      setCode("");
      setName("");
      setSortOrder("0");
      setIsActive(true);
    }
  }, [open, edit]);

  const submit = async () => {
    if (!code.trim() || !name.trim()) {
      toast.error("Vui lòng nhập mã và tên đơn vị.");
      return;
    }

    const payload: CreateDepartmentInput = {
      code: code.trim(),
      name: name.trim(),
      sortOrder: Number(sortOrder) || 0,
      isActive,
    };

    setSaving(true);
    try {
      if (edit) {
        await updateDepartment(entityId(edit), {
          ...payload,
        });
        toast.success("Đã cập nhật đơn vị.");
      } else {
        await createDepartment(payload);
        toast.success("Đã thêm đơn vị.");
      }
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không lưu được đơn vị."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{edit ? "Sửa đơn vị" : "Thêm đơn vị"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit-code">Mã đơn vị</Label>
              <Input
                id="unit-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: TMKH"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-name">Tên đơn vị</Label>
              <Input
                id="unit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Ban Tham mưu Kế hoạch"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit-sort">Thứ tự</Label>
              <Input
                id="unit-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
            <div className="flex h-full items-end">
              <div className="flex h-9 w-full items-center justify-between rounded-lg border px-3">
                <Label htmlFor="unit-active">Đang hoạt động</Label>
                <Switch
                  id="unit-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Hủy
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
