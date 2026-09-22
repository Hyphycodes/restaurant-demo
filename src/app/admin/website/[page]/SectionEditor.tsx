'use client';

import { ActionForm, IntentField, SubmitButton } from '@/components/admin/ActionForm';
import { Card, Checkbox, Label, Select, StateChip, TextArea, TextInput } from '@/components/admin/ui';
import { saveList, saveSection } from '@/server/actions/website';
import { Versions } from '@/components/admin/Versions';
import type { AdminPageSection as PageSection, EditorialState, VersionEntry } from '@/content/admin-types';

/**
 * One named slot.
 *
 * There is no field here for layout, no rich-text toolbar and no way to add a
 * section. Staff change what a section says and which photograph it uses; the
 * design decides how it looks. That is the line between an editable website and
 * one that slowly becomes unmaintainable.
 */
export function SectionEditor({
  section,
  state,
  canPublish,
  mediaOptions,
  allowsMedia,
  versions,
}: {
  section: PageSection;
  state: EditorialState;
  canPublish: boolean;
  mediaOptions: { id: string; label: string }[];
  allowsMedia: boolean;
  versions: VersionEntry[];
}) {
  const id = section.id.replace(/[^a-z0-9]/gi, '-');

  return (
    <Card
      title={sectionTitle(section.key)}
      action={state !== 'published' ? <StateChip state={state} /> : null}
    >
      <ActionForm action={saveSection} className="grid gap-4">
        <input type="hidden" name="id" value={section.id} />
        <IntentField name="publish" initial="false" />

        <div>
          <Label htmlFor={`${id}-eyebrow`} hint="The small line above the heading. Optional.">
            Label
          </Label>
          <TextInput
            id={`${id}-eyebrow`}
            name="eyebrow"
            defaultValue={section.eyebrow ?? ''}
            maxLength={60}
          />
        </div>

        <div>
          <Label htmlFor={`${id}-heading`}>Heading</Label>
          <TextInput
            id={`${id}-heading`}
            name="heading"
            defaultValue={section.heading}
            required
            maxLength={140}
          />
        </div>

        <div>
          <Label htmlFor={`${id}-body`} hint="One or two sentences reads best here.">
            Supporting text
          </Label>
          <TextArea
            id={`${id}-body`}
            name="body"
            rows={3}
            defaultValue={section.body ?? ''}
            maxLength={700}
          />
        </div>

        {allowsMedia ? (
          <div>
            <Label htmlFor={`${id}-media`} hint="Upload new photographs in Photos.">
              Photograph
            </Label>
            <Select id={`${id}-media`} name="mediaAssetId" defaultValue={section.mediaAssetId ?? ''}>
              <option value="">No photograph</option>
              {mediaOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <input type="hidden" name="mediaAssetId" value={section.mediaAssetId ?? ''} />
        )}

        <Checkbox id={`${id}-visible`} name="visible" defaultChecked={section.visible}>
          Show this section on the website
        </Checkbox>

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

      <div className="mt-4">
        <Versions table="page_sections" id={section.id} versions={versions} canRestore={canPublish} />
      </div>
    </Card>
  );
}

const TITLES: Record<string, string> = {
  hero: 'The big opening panel',
  opener: 'The heading at the top of the page',
  breadth: 'What we serve',
  'two-paths': 'Catering and celebrations',
};

function sectionTitle(key: string): string {
  return TITLES[key] ?? key.replace(/-/g, ' ');
}

/**
 * An editable option list — the choices in an enquiry form, the perks list.
 * Only the visible options; nothing about how the form validates or where it is
 * delivered is exposed here.
 */
export function ListEditor({
  id,
  label,
  items,
  canPublish,
  state,
}: {
  id: string;
  label: string;
  items: string[];
  canPublish: boolean;
  state: EditorialState;
}) {
  const safeId = id.replace(/[^a-z0-9]/gi, '-');
  return (
    <Card title={label} action={state !== 'published' ? <StateChip state={state} /> : null}>
      <ActionForm action={saveList} className="grid gap-3">
        <input type="hidden" name="id" value={id} />
        <IntentField name="publish" initial="false" />
        <div>
          <Label htmlFor={`${safeId}-items`} hint="One per line. The order here is the order guests see.">
            Options
          </Label>
          <TextArea
            id={`${safeId}-items`}
            name="items"
            rows={Math.min(12, Math.max(4, items.length + 1))}
            defaultValue={items.join('\n')}
          />
        </div>
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
    </Card>
  );
}
