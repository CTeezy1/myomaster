-- Profiles for authenticated learners. Creation is server-only (service role).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  username_slug text not null,
  section text not null,
  created_at timestamptz not null default now(),
  constraint profiles_section_check check (
    section in (
      'Testing',
      'Kinesiology 1',
      'Kinesiology 2',
      'Movement Anatomy 1',
      'Movement Anatomy 2'
    )
  ),
  constraint profiles_username_slug_unique unique (username_slug)
);

create index profiles_section_idx on public.profiles (section);

alter table public.profiles enable row level security;

create policy "Authenticated users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);
