import { render } from '@react-email/render';
import type { ComponentType } from 'react';
import type { TemplateId } from './registry';
import type {
  AccountEmailProps,
  EventReminderProps,
  EventUpdateProps,
  RefundConfirmationProps,
  RenderedEmail,
  StaffEmailProps,
  StaffInvitationProps,
  TicketConfirmationProps,
  TicketResendProps,
} from './types';
import * as EventReminder from './templates/EventReminder';
import * as EventUpdate from './templates/EventUpdate';
import * as MagicLink from './templates/MagicLink';
import * as PasswordReset from './templates/PasswordReset';
import * as RefundConfirmation from './templates/RefundConfirmation';
import * as StaffInvitation from './templates/StaffInvitation';
import * as ThanksForComing from './templates/ThanksForComing';
import * as TicketConfirmation from './templates/TicketConfirmation';
import * as TicketResend from './templates/TicketResend';
import * as VerifyEmail from './templates/VerifyEmail';
import * as Welcome from './templates/Welcome';
import * as StaffWelcome from './templates/staff/StaffWelcome';
import * as SchedulePublished from './templates/staff/SchedulePublished';
import * as ShiftChanged from './templates/staff/ShiftChanged';
import * as TimeOffDecision from './templates/staff/TimeOffDecision';
import * as TrainingRequired from './templates/staff/TrainingRequired';
import * as DocumentExpiring from './templates/staff/DocumentExpiring';
import * as EventAssignment from './templates/staff/EventAssignment';
import * as ApplicationReceived from './templates/people/ApplicationReceived';
import * as TalentReceived from './templates/people/TalentReceived';
import * as SubmissionAlert from './templates/people/SubmissionAlert';

/**
 * Template id → props, so a caller cannot render a refund with ticket props.
 * The service, the admin preview and the tests all come through here.
 */
export interface TemplateProps {
  ticket_confirmation: TicketConfirmationProps;
  event_reminder: EventReminderProps;
  ticket_resend: TicketResendProps;
  refund_confirmation: RefundConfirmationProps;
  event_update: EventUpdateProps;
  thanks_for_coming: ThanksForComing.ThanksForComingProps;
  staff_invitation: StaffInvitationProps;
  magic_link: AccountEmailProps;
  password_reset: AccountEmailProps;
  verify_email: AccountEmailProps;
  welcome: AccountEmailProps;
  staff_welcome: StaffEmailProps;
  schedule_published: StaffEmailProps;
  shift_changed: StaffEmailProps;
  time_off_decision: StaffEmailProps;
  training_required: StaffEmailProps;
  document_expiring: StaffEmailProps;
  event_assignment: StaffEmailProps;
  application_received: StaffEmailProps;
  talent_received: StaffEmailProps;
  submission_alert: StaffEmailProps;
}

interface TemplateModule<P> {
  default: ComponentType<P>;
  subject: (props: P) => string;
  text: (props: P) => string;
}

const MODULES: { [K in TemplateId]: TemplateModule<TemplateProps[K]> } = {
  ticket_confirmation: TicketConfirmation,
  event_reminder: EventReminder,
  ticket_resend: TicketResend,
  refund_confirmation: RefundConfirmation,
  event_update: EventUpdate,
  thanks_for_coming: ThanksForComing,
  staff_invitation: StaffInvitation,
  magic_link: MagicLink,
  password_reset: PasswordReset,
  verify_email: VerifyEmail,
  welcome: Welcome,
  staff_welcome: StaffWelcome,
  schedule_published: SchedulePublished,
  shift_changed: ShiftChanged,
  time_off_decision: TimeOffDecision,
  training_required: TrainingRequired,
  document_expiring: DocumentExpiring,
  event_assignment: EventAssignment,
  application_received: ApplicationReceived,
  talent_received: TalentReceived,
  submission_alert: SubmissionAlert,
};

export const TEST_SUBJECT_PREFIX = '[TEST] ';

/** Subject, HTML and plain text for one email. Pure: no network, no database. */
export async function renderEmail<K extends TemplateId>(id: K, props: TemplateProps[K]): Promise<RenderedEmail> {
  const mod = MODULES[id] as TemplateModule<TemplateProps[K]>;
  const Component = mod.default;
  const html = await render(<Component {...props} />);
  const test = (props as { test?: boolean }).test === true;
  const subject = `${test ? TEST_SUBJECT_PREFIX : ''}${mod.subject(props)}`;
  const text = `${test ? 'TEST EMAIL — not a real ticket.\n\n' : ''}${mod.text(props)}`;
  return { subject, html, text };
}
