-- Two more values for the staff role enum, on their own because Postgres will
-- not let a transaction use an enum value it has just added. 0022 is the first
-- migration that refers to them.
--
--   staff       an employee. Signs in to the Casa Aurelia staff app (/staff) and has
--               NO content or admin capability: can_edit(), can_publish() and
--               can_administer() all stay false for this role, so every policy
--               written since 0001 already excludes it.
--   contractor  a DJ, painter or photographer with a sign-in. Reserved: nothing
--               grants it anything yet, and nothing in 0022 requires a
--               contractor to have an auth user at all.
--
-- The three existing values keep their meaning: owner and admin (Manager) are
-- the operational management tier; editor (Contributor) edits the website.
--
-- Rollback: enum values cannot be dropped in place. Recreate the type without
-- them only if no profile carries either value.

alter type public.user_role add value if not exists 'staff';
alter type public.user_role add value if not exists 'contractor';
