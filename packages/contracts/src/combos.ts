import { z } from 'zod';

export const comboComponentInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive().max(10_000),
});

const comboWriteFields = {
  name: z.string().trim().min(2).max(100),
  salePriceCents: z.number().int().nonnegative(),
  components: z.array(comboComponentInputSchema).min(1).max(50),
} as const;

interface ComponentCollection {
  readonly components: readonly { readonly productId: string }[];
}

function validateUniqueComponents(value: ComponentCollection, context: z.RefinementCtx): void {
  const uniqueProductIds = new Set(value.components.map((component) => component.productId));

  if (uniqueProductIds.size !== value.components.length) {
    context.addIssue({
      code: 'custom',
      message: 'Um produto não pode aparecer duas vezes no mesmo combo.',
      path: ['components'],
    });
  }
}

export const createComboInputSchema = z
  .object(comboWriteFields)
  .superRefine(validateUniqueComponents);

export const updateComboInputSchema = z
  .object({
    ...comboWriteFields,
    comboId: z.uuid(),
    active: z.boolean(),
  })
  .superRefine(validateUniqueComponents);

export const comboDeletePreviewSchema = z.object({
  comboId: z.uuid(),
  name: z.string().trim().min(2).max(100),
  active: z.boolean(),
  components: z.array(
    z.object({
      productId: z.uuid(),
      productName: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  ),
  historicalSales: z.number().int().nonnegative(),
});

export const previewDeleteComboInputSchema = z.object({
  comboId: z.uuid(),
});

export const deleteComboInputSchema = z.object({
  comboId: z.uuid(),
  reason: z.string().trim().min(3).max(240),
});

export const comboComponentSchema = z.object({
  productId: z.uuid(),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  salePriceCents: z.number().int().nonnegative(),
  availableQuantity: z.number().int().nonnegative(),
});

export const comboFinancialsSchema = z.object({
  costCents: z.number().int().nonnegative(),
  grossProfitCents: z.number().int(),
  marginPercent: z.number(),
});

export const comboSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(100),
  salePriceCents: z.number().int().nonnegative(),
  individualSaleTotalCents: z.number().int().nonnegative(),
  savingsCents: z.number().int(),
  availableUnits: z.number().int().nonnegative(),
  active: z.boolean(),
  components: z.array(comboComponentSchema).min(1),
  financials: comboFinancialsSchema.nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const comboListSchema = z.array(comboSchema);

export type ComboComponentInput = z.infer<typeof comboComponentInputSchema>;
export type CreateComboInput = z.infer<typeof createComboInputSchema>;
export type UpdateComboInput = z.infer<typeof updateComboInputSchema>;
export type ComboDeletePreview = z.infer<typeof comboDeletePreviewSchema>;
export type PreviewDeleteComboInput = z.infer<typeof previewDeleteComboInputSchema>;
export type DeleteComboInput = z.infer<typeof deleteComboInputSchema>;
export type ComboComponent = z.infer<typeof comboComponentSchema>;
export type ComboFinancials = z.infer<typeof comboFinancialsSchema>;
export type InventoryCombo = z.infer<typeof comboSchema>;

export interface ComboApi {
  list(): Promise<readonly InventoryCombo[]>;
  create(input: CreateComboInput): Promise<InventoryCombo>;
  update(input: UpdateComboInput): Promise<InventoryCombo>;
  previewDelete(input: PreviewDeleteComboInput): Promise<ComboDeletePreview>;
  delete(input: DeleteComboInput): Promise<InventoryCombo>;
}
