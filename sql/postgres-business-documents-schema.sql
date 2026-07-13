create table if not exists public.business_documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('trip_plan', 'carrier_bill')),
  entity_id uuid not null,
  document_type text not null check (document_type in ('invoice', 'bol', 'pod', 'loading_list')),
  document_status text not null default 'active' check (document_status in ('active', 'replaced', 'voided')),
  file_name text,
  file_url text,
  storage_path text,
  mime_type text,
  source text check (source in ('generated', 'uploaded')),
  generated_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_documents_entity_idx on public.business_documents (entity_type, entity_id);
create index if not exists business_documents_type_idx on public.business_documents (document_type);
create index if not exists business_documents_status_idx on public.business_documents (document_status);

alter table public.business_documents enable row level security;

drop policy if exists "personal anon read business_documents" on public.business_documents;
drop policy if exists "personal anon write business_documents" on public.business_documents;

create policy "personal anon read business_documents"
on public.business_documents
for select
to anon
using (true);

create policy "personal anon write business_documents"
on public.business_documents
for all
to anon
using (true)
with check (true);
