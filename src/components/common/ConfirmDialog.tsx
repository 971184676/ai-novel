// =============================================================================
// ConfirmDialog —— 删除确认对话框（极简：标题 + 描述 + 取消/确认）
// =============================================================================

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** 确认按钮的 variant；默认 destructive */
  confirmVariant?: 'default' | 'primary' | 'ghost' | 'destructive';
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'destructive',
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            size="sm"
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
