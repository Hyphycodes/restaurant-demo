'use client';

import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Label, TextInput } from '@/components/admin/ui';
import { addCategory, saveCategory, moveRow } from '@/server/actions/menu';

export function AddCategory({ menuSlug }: { menuSlug: string }) {
  return <ActionForm action={addCategory} className="mt-6 border-t border-brown/20 pt-5">
    <input type="hidden" name="menuSlug" value={menuSlug} />
    <Label htmlFor="new-category">Add a category</Label>
    <div className="mt-2 flex flex-wrap gap-3"><TextInput id="new-category" name="name" required maxLength={80} placeholder="Category name" /><SubmitButton>Add category</SubmitButton></div>
    <p className="mt-2 text-sm text-brown-soft">Empty categories stay off the website until you add available items.</p>
  </ActionForm>;
}

export function CategoryControls({ id, name, note, siblings }: { id: string; name: string; note: string | null; siblings: string[] }) {
  return <details className="my-4 border-b border-brown/15 pb-4">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-clay">Edit category and order</summary>
    <ActionForm action={saveCategory} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <div><Label htmlFor={`category-name-${id}`}>Category name</Label><TextInput id={`category-name-${id}`} name="name" defaultValue={name} required maxLength={80} /></div>
      <div><Label htmlFor={`category-note-${id}`}>Category description</Label><TextInput id={`category-note-${id}`} name="note" defaultValue={note ?? ''} maxLength={300} /></div>
      <SubmitButton>Save category</SubmitButton>
    </ActionForm>
    <div className="mt-3 flex gap-3">{(['up','down'] as const).map(direction => <ActionForm key={direction} action={moveRow}>
      <input type="hidden" name="table" value="menu_categories" /><input type="hidden" name="id" value={id} /><input type="hidden" name="siblings" value={siblings.join(',')} /><input type="hidden" name="direction" value={direction} />
      <SubmitButton variant="secondary">Move {direction}</SubmitButton>
    </ActionForm>)}</div>
  </details>;
}
