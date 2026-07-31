-- Explicit table grants for authenticated clients under RLS.

grant select on public.profiles to authenticated;
grant select, insert, update on public.learner_progress to authenticated;
