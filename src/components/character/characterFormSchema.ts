// =============================================================================
// CharacterForm —— 人物创建/编辑表单（用 react-hook-form + zod）
// 字段：姓名、性别、身高、体重、性格、外貌、category、factionId、avatarColor、notes
// =============================================================================

import { z } from 'zod';

export const GENDER_OPTIONS = [
  { value: '男', label: '男' },
  { value: '女', label: '女' },
  { value: '其他', label: '其他' },
];

export const characterFormSchema = z.object({
  name: z
    .string()
    .min(1, '姓名不能为空')
    .max(20, '姓名不能超过 20 字'),
  gender: z.enum(['男', '女', '其他'] as const, {
    message: '请选择性别',
  }),
  height: z.preprocess(
    (v) => {
      if (v === '' || v == null) return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    },
    z.coerce.number().positive('身高必须为正数').max(300, '身高应在 1-300 cm 之间').optional(),
  ),
  weight: z.preprocess(
    (v) => {
      if (v === '' || v == null) return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    },
    z.coerce.number().positive('体重必须为正数').max(500, '体重应在 1-500 kg 之间').optional(),
  ),
  personality: z
    .string()
    .min(1, '请填写性格描述')
    .max(500, '性格描述不能超过 500 字'),
  appearance: z
    .string()
    .min(1, '请填写外貌描述')
    .max(500, '外貌描述不能超过 500 字'),
  category: z.enum(['protagonist', 'supporting', 'villain', 'npc'] as const, {
    message: '请选择角色分类',
  }),
  factionId: z.preprocess(
    (v) => {
      if (v === '' || v == null) return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    },
    z.coerce.number().optional(),
  ),
  avatarColor: z
    .string()
    .min(1, '请选择头像颜色'),
  notes: z.string().max(2000, '备注不能超过 2000 字'),
});

export type CharacterFormValues = z.infer<typeof characterFormSchema>;
