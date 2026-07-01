// =============================================================================
// CharacterFormDialog —— 人物的"新建/编辑"对话框
// =============================================================================

import * as React from 'react';
import { ResourceFormDialog } from '@/components/common/ResourceFormDialog';
import {
  TextField,
  TextareaField,
  EnumBadgeField,
  SelectField,
  ColorSwatchField,
} from '@/components/common/FormField';
import {
  characterFormSchema,
  GENDER_OPTIONS,
  type CharacterFormValues,
} from './characterFormSchema';
import { CHARACTER_CATEGORY_OPTIONS, CharacterShape } from './CharacterShape';
import type { Character } from '@/db/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';

const AVATAR_SWATCHES = [
  '#000000',
  '#1F1F1F',
  '#3F3F3F',
  '#6B6B6B',
  '#8C8C8C',
  '#A3A3A3',
  '#D4D4D4',
  '#FFFFFF',
];

export interface CharacterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = 新建；非空 = 编辑 */
  character?: Character;
  bookId: number;
  onSubmit: (values: CharacterFormValues) => Promise<void> | void;
}

export function CharacterFormDialog({
  open,
  onOpenChange,
  character,
  bookId,
  onSubmit,
}: CharacterFormDialogProps) {
  const factions = useLiveQuery(
    () => db.factions.where('bookId').equals(bookId).toArray(),
    [bookId],
  ) ?? [];

  const factionOptions = [
    { value: '', label: '— 无门派 / 暂无' },
    ...factions.map((f) => ({ value: String(f.id), label: f.name })),
  ];

  const defaultValues: CharacterFormValues = {
    name: character?.name ?? '',
    gender: (character?.gender as any) ?? '男',
    height: character?.height,
    weight: character?.weight,
    personality: character?.personality ?? '',
    appearance: character?.appearance ?? '',
    category: character?.category ?? 'supporting',
    factionId: character?.factionId,
    avatarColor: character?.avatarColor ?? '#000000',
    notes: character?.notes ?? '',
  };

  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={character ? `编辑人物 · ${character.name}` : '新建人物'}
      description={character ? '修改人物的属性，保存后立即生效' : '为本书添加一个角色'}
      schema={characterFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitText={character ? '保存' : '创建'}
      contentClassName="max-w-2xl"
    >
      {() => (
        <div className="space-y-4">
          {/* 姓名 + 头像颜色 */}
          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-7">
              <TextField name="name" placeholder="人物姓名" required />
            </div>
            <div className="col-span-5">
              <ColorSwatchField name="avatarColor" swatches={AVATAR_SWATCHES} label="头像颜色" />
            </div>
          </div>

          {/* 分类 */}
          <EnumBadgeField
            name="category"
            options={CHARACTER_CATEGORY_OPTIONS}
            label="角色分类"
            required
          />

          {/* 性别 + 身高 + 体重 */}
          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-4">
              <EnumBadgeField name="gender" options={GENDER_OPTIONS} label="性别" required />
            </div>
            <div className="col-span-4">
              <TextField name="height" type="number" placeholder="cm" label="身高 (cm)" />
            </div>
            <div className="col-span-4">
              <TextField name="weight" type="number" placeholder="kg" label="体重 (kg)" />
            </div>
          </div>

          {/* 所属阵营 */}
          <SelectField
            name="factionId"
            options={factionOptions}
            label="所属阵营"
            placeholder="选择阵营（可选）"
          />

          {/* 性格 */}
          <TextareaField
            name="personality"
            label="性格描述"
            placeholder="性格特点、价值观、处事方式…"
            rows={3}
            required
          />

          {/* 外貌 */}
          <TextareaField
            name="appearance"
            label="外貌描述"
            placeholder="身形、相貌、衣着、显著特征…"
            rows={3}
            required
          />

          {/* 备注 */}
          <TextareaField
            name="notes"
            label="备注 / 设定笔记"
            placeholder="人物小传、灵感来源、与其他角色的伏笔…"
            rows={4}
          />
        </div>
      )}
    </ResourceFormDialog>
  );
}
