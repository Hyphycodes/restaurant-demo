'use client';

import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { addMenuItem } from '@/server/actions/menu';

/**
 * Add a dish.
 *
 * It arrives hidden from guests, on purpose: a name with no price and no
 * description should not be on the website for the minute between creating it and
 * filling it in.
 */
export function AddItem({ categoryId }: { categoryId: string }) {
  return (
    <ActionForm action={addMenuItem} className="mt-4 border-t border-dashed border-brown/25 pt-4">
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label
            htmlFor={`add-${categoryId}`}
            className="block text-[0.8125rem] font-semibold text-brown"
          >
            Add a dish to this section
          </label>
          <input
            id={`add-${categoryId}`}
            name="name"
            placeholder="Name of the dish"
            className="mt-1.5 min-h-11 w-full rounded-(--radius-sm) border border-brown/25 bg-ivory px-3 text-[0.9375rem] text-brown"
          />
        </div>
        <SubmitButton variant="secondary">Add</SubmitButton>
      </div>
      <p className="mt-1.5 text-[0.8125rem] text-brown-soft">
        It starts hidden from guests so you can fill in the price and description first.
      </p>
    </ActionForm>
  );
}
