// =============================================================================
// FormField —— 通用表单项（label + 控件 + 错误信息）
// 提供 Text / Textarea / Number / Select / Combobox / Color 等子组件，
// 全部以 Controller 接入 react-hook-form。
// =============================================================================

import * as React from 'react';
import { useFormContext, Controller, type FieldValues, type Path } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

// ---------- Wrapper ----------

export interface FieldProps {
  name: string;
  label?: string;
  /** 是否必填（仅 UI 标记用，校验以 zod 规则为准） */
  required?: boolean;
  /** 描述 / hint */
  hint?: string;
  /** 强制 className 覆盖外层 */
  className?: string;
  /** 隐藏 label（不推荐，但有些紧凑场景需要） */
  hideLabel?: boolean;
}

function getError<T extends FieldValues>(errors: any, name: string): string | undefined {
  if (!errors) return undefined;
  const segs = name.split('.');
  let cur = errors;
  for (const s of segs) {
    if (!cur) return undefined;
    cur = cur[s];
  }
  if (cur && typeof cur === 'object' && 'message' in cur) {
    return String(cur.message);
  }
  return undefined;
}

function FieldShell({
  name,
  label,
  required,
  hint,
  className,
  hideLabel,
  children,
}: FieldProps & { children: React.ReactNode }) {
  const methods = useFormContext();
  const error = getError(methods?.formState?.errors, name);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {!hideLabel && label && (
        <Label className="text-2 normal-case tracking-normal flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-text">*</span>}
        </Label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-3 leading-relaxed">{hint}</p>}
      {error && <p className="text-xs text-text leading-relaxed">{error}</p>}
    </div>
  );
}

// ---------- Text ----------

export interface TextFieldProps<T extends FieldValues> extends Omit<FieldProps, 'label'> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'email';
  disabled?: boolean;
  autoComplete?: string;
  inputClassName?: string;
}

export function TextField<T extends FieldValues>({
  name,
  type = 'text',
  ...rest
}: TextFieldProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FieldShell name={name as string} {...(rest as any)} hideLabel={!rest.label}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            type={type}
            value={(field.value ?? '') as string}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            ref={field.ref}
            placeholder={rest.placeholder}
            disabled={rest.disabled}
            autoComplete={rest.autoComplete}
            className={rest.inputClassName}
          />
        )}
      />
    </FieldShell>
  );
}

// ---------- Textarea ----------

export interface TextareaFieldProps<T extends FieldValues> extends Omit<FieldProps, 'label'> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export function TextareaField<T extends FieldValues>({
  name,
  rows = 4,
  ...rest
}: TextareaFieldProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FieldShell name={name as string} {...(rest as any)} hideLabel={!rest.label}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Textarea
            rows={rows}
            value={(field.value ?? '') as string}
            onChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            placeholder={rest.placeholder}
            disabled={rest.disabled}
          />
        )}
      />
    </FieldShell>
  );
}

// ---------- Select (enum) ----------

export interface SelectFieldOption {
  value: string;
  label: string;
}
export interface SelectFieldProps<T extends FieldValues> extends Omit<FieldProps, 'label'> {
  name: Path<T>;
  label?: string;
  options: SelectFieldOption[];
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
}

export function SelectField<T extends FieldValues>({
  name,
  options,
  placeholder,
  ...rest
}: SelectFieldProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FieldShell name={name as string} {...(rest as any)} hideLabel={!rest.label}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={(field.value ?? '') as string}
            onValueChange={(v) => field.onChange(v)}
            disabled={rest.disabled}
          >
            <SelectTrigger className={rest.triggerClassName}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </FieldShell>
  );
}

// ---------- CheckboxGroup (multi-select) ----------

export interface CheckboxGroupOption {
  value: string;
  label: string;
}
export interface CheckboxGroupFieldProps<T extends FieldValues> extends Omit<FieldProps, 'label'> {
  name: Path<T>;
  label?: string;
  options: CheckboxGroupOption[];
  disabled?: boolean;
}

export function CheckboxGroupField<T extends FieldValues>({
  name,
  options,
  ...rest
}: CheckboxGroupFieldProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FieldShell name={name as string} {...(rest as any)} hideLabel={!rest.label}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => {
          const current: string[] = Array.isArray(field.value) ? (field.value as string[]) : [];
          const toggle = (v: string) => {
            if (current.includes(v)) {
              field.onChange(current.filter((x) => x !== v));
            } else {
              field.onChange([...current, v]);
            }
          };
          return (
            <div className="flex flex-wrap gap-1.5">
              {options.map((o) => {
                const on = current.includes(o.value);
                return (
                  <button
                    type="button"
                    key={o.value}
                    onClick={() => toggle(o.value)}
                    disabled={rest.disabled}
                    className={cn(
                      'inline-flex items-center h-7 px-2.5 text-xs border-2 font-semibold transition-all select-none',
                      on
                        ? 'bg-bg text-text border-text shadow-[0_2px_0_0_#000] -translate-y-0.5'
                        : 'bg-bg text-text border-border shadow-[0_2px_0_0_#E5E5E5] hover:border-text hover:-translate-y-0.5 hover:shadow-[0_3px_0_0_#E5E5E5] active:translate-y-[1px] active:shadow-[0_1px_0_0_#E5E5E5]',
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          );
        }}
      />
    </FieldShell>
  );
}

// ---------- ColorSwatch (角色 avatar color) ----------

export interface ColorSwatchFieldProps<T extends FieldValues> extends Omit<FieldProps, 'label'> {
  name: Path<T>;
  label?: string;
  /** 候选颜色（HEX），保持黑灰白体系 */
  swatches?: string[];
  disabled?: boolean;
}

const DEFAULT_SWATCHES = [
  '#000000',
  '#3F3F3F',
  '#6B6B6B',
  '#A3A3A3',
  '#D4D4D4',
  '#FFFFFF',
];

export function ColorSwatchField<T extends FieldValues>({
  name,
  swatches = DEFAULT_SWATCHES,
  ...rest
}: ColorSwatchFieldProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FieldShell name={name as string} {...(rest as any)} hideLabel={!rest.label}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => {
          const value = (field.value ?? swatches[0]) as string;
          return (
            <div className="flex flex-wrap gap-2">
              {swatches.map((s) => {
                const on = s.toLowerCase() === value.toLowerCase();
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => field.onChange(s)}
                    disabled={rest.disabled}
                    aria-label={s}
                    className={cn(
                      'w-7 h-7 border transition-colors',
                      on ? 'border-text ring-1 ring-text ring-offset-1' : 'border-border hover:border-text',
                    )}
                    style={{ background: s }}
                  />
                );
              })}
              <Badge variant="muted" className="font-mono tnum">
                {value}
              </Badge>
            </div>
          );
        }}
      />
    </FieldShell>
  );
}

// ---------- EnumBadge (分类 / 类型用纯文字徽章选择) ----------

export interface EnumBadgeOption {
  value: string;
  label: string;
}
export interface EnumBadgeFieldProps<T extends FieldValues> extends Omit<FieldProps, 'label'> {
  name: Path<T>;
  label?: string;
  options: EnumBadgeOption[];
  disabled?: boolean;
}

export function EnumBadgeField<T extends FieldValues>({
  name,
  options,
  ...rest
}: EnumBadgeFieldProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FieldShell name={name as string} {...(rest as any)} hideLabel={!rest.label}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const on = o.value === field.value;
              return (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => field.onChange(o.value)}
                  disabled={rest.disabled}
                  className={cn(
                    'inline-flex items-center h-8 px-3 text-sm border-2 font-semibold transition-all select-none',
                    on
                      ? 'bg-bg text-text border-text shadow-[0_2px_0_0_#000] -translate-y-0.5'
                      : 'bg-bg text-text border-border shadow-[0_2px_0_0_#E5E5E5] hover:border-text hover:-translate-y-0.5 hover:shadow-[0_3px_0_0_#E5E5E5] active:translate-y-[1px] active:shadow-[0_1px_0_0_#E5E5E5]',
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        )}
      />
    </FieldShell>
  );
}
