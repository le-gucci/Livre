create table books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null default 'Untitled',
  created_at timestamptz default now()
);

create table pages (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books on delete cascade not null,
  page_number int not null,
  image_url text not null,
  created_at timestamptz default now()
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references pages on delete cascade not null,
  user_id uuid references auth.users not null,
  french_phrase text not null,
  english_translation text default '',
  context_summary text default '',
  bbox jsonb,
  created_at timestamptz default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references entries on delete set null,
  user_id uuid references auth.users not null,
  content text not null,
  created_at timestamptz default now()
);

alter table books enable row level security;
alter table pages enable row level security;
alter table entries enable row level security;
alter table notes enable row level security;

create policy "users_own_books" on books for all using (auth.uid() = user_id);
create policy "users_own_pages" on pages for all using (
  book_id in (select id from books where user_id = auth.uid())
);
create policy "users_own_entries" on entries for all using (auth.uid() = user_id);
create policy "users_own_notes" on notes for all using (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('pages', 'pages', true);
create policy "auth_upload_pages" on storage.objects for insert
  with check (bucket_id = 'pages' and auth.uid() is not null);
create policy "public_read_pages" on storage.objects for select
  using (bucket_id = 'pages');
create policy "auth_delete_pages" on storage.objects for delete
  using (bucket_id = 'pages' and auth.uid() is not null);
