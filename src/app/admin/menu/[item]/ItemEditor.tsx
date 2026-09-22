'use client';

import { ActionForm, IntentField, SubmitButton } from '@/components/admin/ActionForm';
import { Card, Checkbox, FieldNote, Label, Select, TextArea, TextInput } from '@/components/admin/ui';
import { archiveRow, discardRowDraft, publishRow, saveMenuItem, unarchiveRow } from '@/server/actions/menu';
import { restoreVersionAction } from '@/server/actions/versions';
import { AVAILABILITY_HELP, AVAILABILITY_LABEL, PRICE_MODE_LABEL } from '@/content/labels';
import type { AdminMenuCategory, AdminMenuItem, VersionEntry } from '@/content/admin-types';

const DIETARY = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten-free-option', label: 'Gluten-free option' },
  { value: 'spicy', label: 'Spicy' },
];

/**
 * The full dish editor.
 *
 * Choices and paid add-ons are plain text, one per line, because that is how the
 * information exists in someone's head — "Mole, Mango Habanero, Buffalo, BBQ" —
 * and because a repeater with four controls per row is unusable on the phone this
 * is edited on. The parser is forgiving about `+` and `$`.
 */
export function ItemEditor({
  item,
  categories,
  versions,
  canPublish,
  archived,
}: {
  item: AdminMenuItem;
  categories: AdminMenuCategory[];
  versions: VersionEntry[];
  canPublish: boolean;
  archived: boolean;
}) {
  const choices = item.modifiers.filter((m) => m.priceCents == null);
  const addOns = item.modifiers.filter((m) => m.priceCents != null);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <ActionForm action={saveMenuItem} className="grid gap-5">
        <input type="hidden" name="id" value={item.id} />
        <IntentField name="publish" initial="false" />
        <input type="hidden" name="dietary" value="" />

        <Card title="The dish">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <TextInput id="name" name="name" defaultValue={item.name} required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="description" hint="One or two lines. What is in it, plainly.">
                Description
              </Label>
              <TextArea
                id="description"
                name="description"
                rows={3}
                defaultValue={item.description ?? ''}
                maxLength={600}
              />
            </div>
            <div>
              <Label htmlFor="categoryId" hint="Moving it keeps the web address of both sections.">
                Section
              </Label>
              <Select id="categoryId" name="categoryId" defaultValue={item.categoryId}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>

        <Card title="Price">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="mode">How it is priced</Label>
              <Select id="mode" name="mode" defaultValue={item.priceMode}>
                {Object.entries(PRICE_MODE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="amount" hint="Only used when it has a set price.">
                Amount
              </Label>
              <TextInput
                id="amount"
                name="amount"
                inputMode="decimal"
                placeholder="16"
                defaultValue={item.priceCents != null ? String(item.priceCents / 100) : ''}
                aria-describedby="amount-note"
              />
              <FieldNote id="amount-note">Numbers only — 16, or 16.50.</FieldNote>
            </div>
          </div>
        </Card>

        <Card title="On the menu today">
          <div className="grid gap-2">
            {(Object.keys(AVAILABILITY_LABEL) as (keyof typeof AVAILABILITY_LABEL)[]).map(
              (value) => (
                <label
                  key={value}
                  htmlFor={`availability-${value}`}
                  className="flex min-h-11 items-start gap-3 rounded-(--radius-sm) border border-brown/20 p-3"
                >
                  <input
                    id={`availability-${value}`}
                    type="radio"
                    name="availability"
                    value={value}
                    defaultChecked={item.availability === value}
                    className="mt-1 size-4 shrink-0 accent-[var(--color-coral)]"
                  />
                  <span>
                    <span className="block text-[0.9375rem] font-semibold text-brown">
                      {AVAILABILITY_LABEL[value]}
                    </span>
                    <span className="block text-[0.8125rem] text-brown-soft">
                      {AVAILABILITY_HELP[value]}
                    </span>
                  </span>
                </label>
              ),
            )}
          </div>
        </Card>

        <Card title="Choices and extras">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="modifierGroupLabel" hint="For example “Sauce” or “Choice of meat”.">
                What the choice is called
              </Label>
              <TextInput
                id="modifierGroupLabel"
                name="modifierGroupLabel"
                defaultValue={item.modifierGroupLabel ?? ''}
                maxLength={60}
              />
            </div>
            <div>
              <Label htmlFor="choices" hint="One per line, or separated by commas. No prices.">
                Choices
              </Label>
              <TextArea
                id="choices"
                name="choices"
                rows={3}
                defaultValue={choices.map((m) => m.label).join('\n')}
                placeholder={'Mole\nMango Habanero\nBuffalo\nBBQ'}
              />
            </div>
            <div>
              <Label htmlFor="addOns" hint="One per line, with the extra cost: “Add meat 4”.">
                Paid extras
              </Label>
              <TextArea
                id="addOns"
                name="addOns"
                rows={3}
                defaultValue={addOns.map((m) => `${m.label} ${(m.priceCents ?? 0) / 100}`).join('\n')}
                placeholder={'Add meat 4\nShrimp 6'}
              />
            </div>
          </div>
        </Card>

        <Card title="Labels">
          <div className="grid gap-1 sm:grid-cols-2">
            {DIETARY.map((tag) => (
              <label
                key={tag.value}
                htmlFor={`dietary-${tag.value}`}
                className="flex min-h-11 items-center gap-2.5 text-[0.9375rem] text-brown"
              >
                <input
                  id={`dietary-${tag.value}`}
                  type="checkbox"
                  name="dietary"
                  value={tag.value}
                  defaultChecked={item.dietary.includes(tag.value as never)}
                  className="size-4 shrink-0 accent-[var(--color-coral)]"
                />
                {tag.label}
              </label>
            ))}
          </div>
          <div className="mt-3 border-t border-brown/12 pt-3">
            <Checkbox id="featured" name="featured" defaultChecked={item.featured}>
              Can appear as a highlight on the homepage
            </Checkbox>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          {canPublish ? (
            <SubmitButton name="publish" value="true">
              Save and publish
            </SubmitButton>
          ) : null}
          <SubmitButton variant="secondary" name="publish" value="false">
            {canPublish ? 'Save as a draft' : 'Save'}
          </SubmitButton>
        </div>
      </ActionForm>

      <div className="grid gap-4">
        <Card title="Status" tone="quiet">
          <p className="text-[0.9375rem] leading-relaxed text-brown-soft">
            {item.state === 'changed'
              ? 'There are saved changes that guests cannot see yet.'
              : item.state === 'archived'
                ? 'This is off the website. Nothing was deleted.'
                : 'Everything here is live on the website.'}
          </p>

          {item.state === 'changed' ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {canPublish ? (
                <ActionForm action={publishRow}>
                  <input type="hidden" name="table" value="menu_items" />
                  <input type="hidden" name="id" value={item.id} />
                  <SubmitButton>Publish now</SubmitButton>
                </ActionForm>
              ) : null}
              <ActionForm action={discardRowDraft}>
                <input type="hidden" name="table" value="menu_items" />
                <input type="hidden" name="id" value={item.id} />
                <SubmitButton variant="secondary">Discard changes</SubmitButton>
              </ActionForm>
            </div>
          ) : null}

          {canPublish ? (
            <div className="mt-4 border-t border-brown/12 pt-4">
              <ActionForm action={archived ? unarchiveRow : archiveRow}>
                <input type="hidden" name="table" value="menu_items" />
                <input type="hidden" name="id" value={item.id} />
                <SubmitButton variant={archived ? 'secondary' : 'danger'}>
                  {archived ? 'Put back on the website' : 'Take off the website'}
                </SubmitButton>
              </ActionForm>
              <p className="mt-2 text-[0.8125rem] text-brown-soft">
                Nothing is deleted — you can always put it back.
              </p>
            </div>
          ) : null}
        </Card>

        {versions.length > 0 ? (
          <Card title="Earlier versions" tone="quiet">
            <ul className="grid gap-2">
              {versions.map((version) => (
                <li key={version.id} className="border-b border-brown/12 pb-2 last:border-b-0">
                  <p className="text-[0.8125rem] text-brown">
                    {new Date(version.at).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                  <p className="text-[0.8125rem] text-brown-soft">
                    {version.actorName} · {version.label}
                  </p>
                  {canPublish ? (
                    <ActionForm action={restoreVersionAction}>
                      <input type="hidden" name="table" value="menu_items" />
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="versionId" value={version.id} />
                      <SubmitButton variant="quiet">Bring this version back</SubmitButton>
                    </ActionForm>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-brown-soft">
              Restoring puts the old wording back as a draft, so you can look at it before it goes
              live.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
