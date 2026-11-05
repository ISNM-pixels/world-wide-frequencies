-- This migration belongs only to the World Wide Frequencies project.
create table public.wwf_admin (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id)
);
create table public.wwf_secrets (
  singleton boolean primary key default true check (singleton),
  bootstrap_hash text not null,
  bootstrap_used boolean not null default false,
  build_hash text not null,
  deploy_hook text not null default ''
);
create table public.wwf_draft (
  singleton boolean primary key default true check (singleton),
  content jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.wwf_publications (
  id uuid primary key default gen_random_uuid(),
  content jsonb not null,
  draft_version integer not null,
  state text not null default 'pending' check (state in ('pending','live','previous','failed')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create unique index wwf_one_pending_publication on public.wwf_publications ((state)) where state = 'pending';
create table public.wwf_media (
  path text primary key check (path ~ '^media/[a-f0-9]{64}\.(webp|mp3)$'),
  bytes integer not null check (bytes > 0 and bytes <= 2097152),
  mime text not null check (mime in ('image/webp','audio/mpeg')),
  duration real,
  original_name text not null,
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['wwf_admin','wwf_secrets','wwf_draft','wwf_publications','wwf_media'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
-- No browser role has a direct content policy. All access goes through the
-- authenticated Edge Function; drafts and secrets are never exposed to anon.
create function public.wwf_save_draft(p_content jsonb, p_version integer)
returns setof public.wwf_draft language sql security invoker set search_path = public
as $$ update public.wwf_draft set content=p_content,version=version+1,updated_at=now()
where singleton=true and version=p_version returning *; $$;
revoke all on function public.wwf_save_draft(jsonb,integer) from public,anon,authenticated;
grant execute on function public.wwf_save_draft(jsonb,integer) to service_role;

create function public.wwf_publish(p_version integer)
returns public.wwf_publications language plpgsql security invoker set search_path = public
as $$ declare draft public.wwf_draft; pending public.wwf_publications; begin
  select * into draft from public.wwf_draft where singleton=true for update;
  if draft.version <> p_version then raise exception 'draft_conflict'; end if;
  select * into pending from public.wwf_publications where state='pending';
  if found then
    if pending.draft_version=p_version then return pending; end if;
    raise exception 'publication_pending';
  end if;
  insert into public.wwf_publications(content,draft_version) values(draft.content,draft.version) returning * into pending;
  return pending;
end $$;
revoke all on function public.wwf_publish(integer) from public,anon,authenticated;
grant execute on function public.wwf_publish(integer) to service_role;

create function public.wwf_mark_live(p_id uuid)
returns void language plpgsql security invoker set search_path = public
as $$ begin
  perform pg_advisory_xact_lock(8841901);
  if not exists(select 1 from public.wwf_publications where id=p_id and state='pending') then return; end if;
  update public.wwf_publications set state='previous' where state='live';
  update public.wwf_publications set state='live',published_at=now() where id=p_id;
  delete from public.wwf_publications where state in ('previous','failed') and id not in
    (select id from public.wwf_publications where state in ('previous','failed') order by created_at desc limit 2);
end $$;
revoke all on function public.wwf_mark_live(uuid) from public,anon,authenticated;
grant execute on function public.wwf_mark_live(uuid) to service_role;

-- No public registration: only the predefined owner email may be provisioned.
create function public.wwf_restrict_signup() returns trigger language plpgsql security invoker
set search_path = public as $$ begin
  if lower(new.email) is distinct from 'imagesoundandmedia@tutamail.com' then
    raise exception 'Public registration is disabled';
  end if;
  return new;
end $$;
revoke all on function public.wwf_restrict_signup() from public,anon,authenticated;
create trigger wwf_owner_only before insert on auth.users for each row execute function public.wwf_restrict_signup();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('wwf-media','wwf-media',false,2097152,array['image/webp','audio/mpeg']);
