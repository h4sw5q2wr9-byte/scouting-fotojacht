\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","email":"owner@example.test","role":"authenticated"}';
select (public.create_team('Vossen')->>'id') as team \gset
select public.rotate_team_invite(:'team') as invite \gset
select set_config('test.team',:'team',false);
select set_config('test.invite',:'invite',false);
insert into public.photos(id,team_id,owner_id,challenge_id,object_path,points)
 values('44444444-4444-4444-8444-444444444444',:'team','11111111-1111-4111-8111-111111111111','foto-114',:'team'||'/11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.jpg',5);
insert into storage.objects(bucket_id,name) values('team-photos',:'team'||'/11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.jpg');
do $$begin
 if (select count(*) from public.photos)<>1 or (select count(*) from storage.objects)<>1 then raise exception 'Owner cannot see photo';end if;
end$$;
-- A separate signed-in account cannot browse another team's metadata or image objects.
set request.jwt.claims='{"sub":"33333333-3333-4333-8333-333333333333","email":"outsider@example.test","role":"authenticated"}';
do $$begin
 if (select count(*) from public.teams)<>0 or (select count(*) from public.photos)<>0 or (select count(*) from public.team_members)<>0 or (select count(*) from storage.objects)<>0 then raise exception 'Cross-team leak';end if;
 begin
  insert into storage.objects(bucket_id,name) values('team-photos',current_setting('test.team')||'/33333333-3333-4333-8333-333333333333/55555555-5555-4555-8555-555555555555.jpg');
  raise exception 'Outsider upload allowed';exception when insufficient_privilege then null;
 end;
 begin
  insert into public.photos(id,team_id,owner_id,challenge_id,object_path) values('55555555-5555-4555-8555-555555555555',current_setting('test.team')::uuid,auth.uid(),'foto-114',current_setting('test.team')||'/'||auth.uid()||'/55555555-5555-4555-8555-555555555555.jpg');
  raise exception 'Outsider metadata insert allowed';exception when insufficient_privilege then null;
 end;
 begin perform public.rotate_team_invite(current_setting('test.team')::uuid);raise exception 'Outsider invite allowed';exception when raise_exception then if sqlerrm='Outsider invite allowed' then raise;end if;end;
 begin perform * from public.team_invites;raise exception 'Invite hashes visible';exception when insufficient_privilege then null;end;
 if not (public.join_team(repeat('0',48)) ? 'error') then raise exception 'Invalid invite accepted';end if;
end$$;
reset role;
do $$begin if (select attempts from public.invite_attempts where user_id='33333333-3333-4333-8333-333333333333')<>1 then raise exception 'Failed invite attempt rolled back';end if;end$$;
-- A valid invitation grants membership; signed-in member may view but cannot impersonate another uploader.
set role authenticated;
set request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","email":"member@example.test","role":"authenticated"}';
select public.join_team(:'invite');
do $$begin
 if (select count(*) from public.photos)<>1 or (select count(*) from storage.objects)<>1 then raise exception 'Member cannot see photo';end if;
 begin insert into storage.objects(bucket_id,name) values('team-photos',current_setting('test.team')||'/11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555.jpg');raise exception 'Uploader impersonation allowed';exception when insufficient_privilege then null;end;
 delete from public.photos where id='44444444-4444-4444-8444-444444444444';
 if (select count(*) from public.photos)<>1 then raise exception 'Member deleted someone else photo';end if;
end$$;
-- Owner revokes member access and rotates the code.
set request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","email":"owner@example.test","role":"authenticated"}';
select public.remove_team_member(:'team','22222222-2222-4222-8222-222222222222');
select public.rotate_team_invite(:'team');
set request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","email":"member@example.test","role":"authenticated"}';
do $$begin
 if (select count(*) from public.photos)<>0 or (select count(*) from storage.objects)<>0 then raise exception 'Removed member still has access';end if;
 if not (public.join_team(current_setting('test.invite')) ? 'error') then raise exception 'Old code still accepted';end if;
end$$;
-- Anonymous visitors cannot read image objects or execute authenticated RPCs.
reset role;
set role anon;
set request.jwt.claims='{}';
do $$begin
 if (select count(*) from storage.objects)<>0 then raise exception 'Anonymous image access';end if;
 begin perform * from public.photos;raise exception 'Anonymous metadata access';exception when insufficient_privilege then null;end;
 begin perform public.create_team('Bad');raise exception 'Anonymous RPC access';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$begin if (select public from storage.buckets where id='team-photos') then raise exception 'Bucket is public';end if;end$$;
select 'PASS: owner/member/outsider/anonymous isolation; insert/delete rules; invitation rotation and revocation; failed-attempt persistence; private bucket' as result;
