'use client';

import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Card, Checkbox } from '@/components/admin/ui';
import { syncTickeri } from '@/server/actions/event-presentation';


export function TickeriSync({ lastSyncedLabel }: { lastSyncedLabel: string | null }) {
  return (
    <Card title="Check Tickeri for new events">
      <p className="measure text-[0.9375rem] leading-relaxed text-brown-soft">
        Reads your Tickeri events page and brings across anything new, plus any changed dates,
        prices, sold-out marks and ticket links. It never changes how an event looks on the website,
        and it only fills in an official flyer where there is not one already.
      </p>
      {lastSyncedLabel ? (
        <p className="mt-2 text-[0.875rem] text-brown-soft">Last checked {lastSyncedLabel}.</p>
      ) : null}

      <ActionForm action={syncTickeri} className="mt-4 grid gap-3">
        <div className="grid gap-1">
          <Checkbox id="sync-flyers" name="importFlyers" defaultChecked>
            Bring in the official flyer for events that do not have one
          </Checkbox>
          <Checkbox id="sync-publish" name="publishNew">
            Put new events straight on the website
          </Checkbox>
        </div>
        <p className="text-[0.8125rem] text-brown-soft">
          Leave the second one unticked and new events wait as drafts for you to look over first.
        </p>
        <div>
          <SubmitButton>Check Tickeri now</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}
