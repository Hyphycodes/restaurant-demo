'use client';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Label, Select, TextInput } from '@/components/admin/ui';
import { addTeamMember } from '@/server/actions/team';

export function AddTeamMember() {
  return <ActionForm action={addTeamMember} className="grid gap-4">
    <div><Label htmlFor="new-staff-name">Name</Label><TextInput id="new-staff-name" name="name" required maxLength={100} autoComplete="name" /></div>
    <div><Label htmlFor="new-staff-email">Email</Label><TextInput id="new-staff-email" name="email" type="email" required autoComplete="email" /></div>
    <div><Label htmlFor="new-staff-role">Role</Label><Select id="new-staff-role" name="role" defaultValue="editor"><option value="editor">Contributor — saves drafts</option><option value="admin">Manager — can publish</option></Select></div>
    <SubmitButton>Create staff account</SubmitButton>
    <p className="text-sm text-brown-soft">Share the staff sign-in page after creating the account. They verify their own email; you never choose or handle their password.</p>
  </ActionForm>;
}
