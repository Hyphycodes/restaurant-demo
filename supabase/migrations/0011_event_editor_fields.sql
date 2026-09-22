-- What the event editor asks that the event did not yet have a home for.
--
--   description_html   the description with bold, italic, links and lists,
--                      sanitised on the server; `description` keeps the plain
--                      text for summaries and structured data
--   included_text      "what's included", one line, shown as a sentence
--   bring_text         "what to bring"
--   arrival_text       "arrive 15 minutes early", "park behind the building"
--
-- Rollback:
--   alter table public.event_occurrences
--     drop column if exists description_html, drop column if exists included_text,
--     drop column if exists bring_text, drop column if exists arrival_text;

alter table public.event_occurrences
  add column if not exists description_html text,
  add column if not exists included_text text,
  add column if not exists bring_text text,
  add column if not exists arrival_text text;
