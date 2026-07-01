// =============================================================================
// ResourceFormDialog —— 通用"创建/编辑"对话框
// 用法：
//   <ResourceFormDialog
//     open={open}
//     onOpenChange={setOpen}
//     title="新建人物"
//     defaultValues={...}
//     schema={zodSchema}
//     onSubmit={async (vals) => { ... }}
//     submitText="创建"
//   >
//     {(form) => (<> ... form fields using <TextField name="name" /> ... </>)}
//   </ResourceFormDialog>
// =============================================================================

import * as React from 'react';
import { FormProvider, useForm, type DefaultValues, type FieldValues, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ResourceFormDialogProps<TForm extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Zod schema（用于表单校验和类型推断）
   *  zod 4 中 schema 的 input/output 可能不一致（.default()、.transform()），
   *  所以这里把 input 放宽成 any。运行时由 schema 决定。 */
  schema: z.ZodType<TForm, any>;
  defaultValues: DefaultValues<TForm>;
  onSubmit: SubmitHandler<TForm>;
  submitText?: string;
  cancelText?: string;
  /** 编辑模式下显示"删除"按钮 */
  onDelete?: () => void;
  deleteText?: string;
  /** render prop：传入 form 上下文，子节点直接用 <TextField> 等 */
  children: (form: { values: TForm }) => React.ReactNode;
  /** 提交按钮的 variant */
  submitVariant?: 'default' | 'primary' | 'ghost';
  /** 自定义 dialog 宽度（className） */
  contentClassName?: string;
}

export function ResourceFormDialog<TForm extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  submitText = '保存',
  cancelText = '取消',
  onDelete,
  deleteText = '删除',
  children,
  submitVariant = 'primary',
  contentClassName,
}: ResourceFormDialogProps<TForm>) {
  const methods = useForm<TForm>({
    // @hookform/resolvers v5 + zod v4 have a strict input/output type split
    // that doesn't play well with our generic TForm. Cast is safe — we trust
    // the caller's schema + defaultValues pairing.
    resolver: zodResolver(schema) as any,
    defaultValues,
    mode: 'onBlur',
  });

  // 当 defaultValues 变化时（如切换到不同的待编辑项）重置表单
  React.useEffect(() => {
    if (open) {
      methods.reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(defaultValues)]);

  const handleSubmit = methods.handleSubmit(async (vals) => {
    await onSubmit(vals as TForm);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName ?? 'max-w-2xl'}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit} className="contents">
            <DialogBody className="space-y-4">
              {children({ values: methods.watch() as TForm })}
            </DialogBody>
            <DialogFooter>
              {onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onDelete}
                  className="mr-auto"
                >
                  {deleteText}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                {cancelText}
              </Button>
              <Button type="submit" variant={submitVariant} size="sm" disabled={methods.formState.isSubmitting}>
                {submitText}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
