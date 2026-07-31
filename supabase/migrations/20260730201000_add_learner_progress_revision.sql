-- Optimistic concurrency via integer revision instead of updated_at equality.

alter table public.learner_progress
  add column revision bigint not null default 1;

create or replace function public.set_learner_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;
