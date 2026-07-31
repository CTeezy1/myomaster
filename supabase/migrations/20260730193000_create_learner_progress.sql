-- Per-learner study progress. Reads/writes use the authenticated client (RLS enforced).

create table public.learner_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  progress_data jsonb not null,
  updated_at timestamptz not null default now()
);

create index learner_progress_updated_at_idx on public.learner_progress (updated_at);

alter table public.learner_progress enable row level security;

create policy "Authenticated learners can read own progress"
  on public.learner_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Authenticated learners can insert own progress"
  on public.learner_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Authenticated learners can update own progress"
  on public.learner_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_learner_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger learner_progress_set_updated_at
  before update on public.learner_progress
  for each row
  execute function public.set_learner_progress_updated_at();
