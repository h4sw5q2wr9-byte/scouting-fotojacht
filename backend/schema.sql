-- Apply to a dedicated Supabase project. Never put a service_role key in the site.
-- Deliberately private: public website ≠ public photos.
begin;
create extension if not exists pgcrypto with schema extensions;
create table public.teams (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 40),
 owner_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.team_members (
 team_id uuid not null references public.teams(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null,
 joined_at timestamptz not null default now(),
 primary key(team_id,user_id)
);
create index team_members_user on public.team_members(user_id);
create table public.team_invites (
 team_id uuid primary key references public.teams(id) on delete cascade,
 token_hash bytea not null unique,
 expires_at timestamptz not null
);
create table public.invite_attempts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 started_at timestamptz not null default now(),
 attempts int not null default 0
);
create table public.photos (
 id uuid primary key,
 team_id uuid not null references public.teams(id) on delete cascade,
 owner_id uuid not null references auth.users(id),
 challenge_id text not null check(challenge_id ~ '^foto-[0-9]{3}$'),
 object_path text not null unique,
 points int not null default 0 check(points between 0 and 10),
 created_at timestamptz not null default now(),
 check(object_path = team_id::text || '/' || owner_id::text || '/' || id::text || '.jpg')
);
create index photos_team_date on public.photos(team_id,created_at);
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.photos enable row level security;
-- Helpers prevent recursive membership RLS. They expose only a boolean for the caller.
create function public.is_team_member(p_team uuid) returns boolean
 language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.team_members where team_id=p_team and user_id=(select auth.uid()));
$$;
create function public.is_team_owner(p_team uuid) returns boolean
 language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.teams where id=p_team and owner_id=(select auth.uid()));
$$;
create policy teams_read on public.teams for select to authenticated using(public.is_team_member(id));
create policy members_read on public.team_members for select to authenticated using(public.is_team_member(team_id));
create policy photos_read on public.photos for select to authenticated using(public.is_team_member(team_id));
create policy photos_insert on public.photos for insert to authenticated with check(owner_id=(select auth.uid()) and public.is_team_member(team_id));
create policy photos_delete on public.photos for delete to authenticated using(public.is_team_member(team_id) and (owner_id=(select auth.uid()) or public.is_team_owner(team_id)));
revoke all on public.teams,public.team_members,public.team_invites,public.invite_attempts,public.photos from anon,authenticated;
grant select on public.teams,public.team_members to authenticated;
grant select,insert,delete on public.photos to authenticated;
-- Teams/members/invite hashes cannot be inserted or changed directly from the API.
create function public.create_team(p_name text) returns jsonb
 language plpgsql security definer set search_path='' as $$
 declare v_team public.teams;v_user uuid:=auth.uid();
 begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if length(btrim(p_name)) not between 1 and 40 then raise exception 'Invalid team name';end if;
  if (select count(*) from public.teams where owner_id=v_user)>=20 then raise exception 'Team limit reached';end if;
  insert into public.teams(name,owner_id) values(btrim(p_name),v_user) returning * into v_team;
  insert into public.team_members(team_id,user_id,display_name) values(v_team.id,v_user,coalesce(auth.jwt()->>'email','Teamlid'));
  return to_jsonb(v_team);
 end;
$$;
create function public.rotate_team_invite(p_team uuid) returns text
 language plpgsql security definer set search_path='' as $$
 declare v_code text;
 begin
  if not public.is_team_owner(p_team) then raise exception 'Only the team owner can invite';end if;
  v_code:=encode(extensions.gen_random_bytes(24),'hex');
  insert into public.team_invites(team_id,token_hash,expires_at) values(p_team,extensions.digest(v_code,'sha256'),now()+interval '24 hours')
   on conflict(team_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
  return v_code;
 end;
$$;
create function public.join_team(p_code text) returns jsonb
 language plpgsql security definer set search_path='' as $$
 declare v_user uuid:=auth.uid();v_team uuid;v_count int;
 begin
  if v_user is null then raise exception 'Sign in required';end if;
  insert into public.invite_attempts(user_id,started_at,attempts) values(v_user,now(),1)
   on conflict(user_id) do update set
    attempts=case when public.invite_attempts.started_at<now()-interval '1 hour' then 1 else public.invite_attempts.attempts+1 end,
    started_at=case when public.invite_attempts.started_at<now()-interval '1 hour' then now() else public.invite_attempts.started_at end
   returning attempts into v_count;
  -- Return errors rather than raise so failed attempts are committed, not rolled back.
  if v_count>30 then return jsonb_build_object('error','Te veel pogingen. Probeer over een uur opnieuw.');end if;
  if p_code !~ '^[0-9a-f]{48}$' then return jsonb_build_object('error','De uitnodigingscode klopt niet of is verlopen.');end if;
  select team_id into v_team from public.team_invites where token_hash=extensions.digest(p_code,'sha256') and expires_at>now();
  if v_team is null then return jsonb_build_object('error','De uitnodigingscode klopt niet of is verlopen.');end if;
  insert into public.team_members(team_id,user_id,display_name) values(v_team,v_user,coalesce(auth.jwt()->>'email','Teamlid')) on conflict do nothing;
  return jsonb_build_object('id',v_team);
 end;
$$;
create function public.remove_team_member(p_team uuid,p_user uuid) returns void
 language plpgsql security definer set search_path='' as $$
 begin
  if not public.is_team_owner(p_team) then raise exception 'Only the team owner can remove members';end if;
  if p_user=auth.uid() then raise exception 'The owner cannot be removed';end if;
  delete from public.team_members where team_id=p_team and user_id=p_user;
 end;
$$;
revoke all on function public.is_team_member(uuid),public.is_team_owner(uuid),public.create_team(text),public.rotate_team_invite(uuid),public.join_team(text),public.remove_team_member(uuid,uuid) from public,anon;
grant execute on function public.is_team_member(uuid),public.is_team_owner(uuid),public.create_team(text),public.rotate_team_invite(uuid),public.join_team(text),public.remove_team_member(uuid,uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('team-photos','team-photos',false,5242880,array['image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg'];
-- The folder membership is checked against the current signed-in user on every request.
-- Regex + EXISTS avoids casting malformed paths to UUIDs.
create policy fotojacht_storage_read on storage.objects for select to authenticated using(
 bucket_id='team-photos' and exists(select 1 from public.teams t where t.id::text=(storage.foldername(storage.objects.name))[1] and public.is_team_member(t.id))
);
create policy fotojacht_storage_insert on storage.objects for insert to authenticated with check(
 bucket_id='team-photos' and (storage.foldername(storage.objects.name))[2]=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
 and exists(select 1 from public.teams t where t.id::text=(storage.foldername(storage.objects.name))[1] and public.is_team_member(t.id))
);
create policy fotojacht_storage_delete on storage.objects for delete to authenticated using(
 bucket_id='team-photos' and exists(select 1 from public.teams t where t.id::text=(storage.foldername(storage.objects.name))[1]
 and public.is_team_member(t.id) and ((storage.foldername(storage.objects.name))[2]=(select auth.uid())::text or public.is_team_owner(t.id)))
);
commit;
