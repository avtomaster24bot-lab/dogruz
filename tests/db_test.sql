-- Проверка vz_* на локальном PostgreSQL (после local_shim.sql и vz_schema.sql)
\set ON_ERROR_STOP 1
\set K1 '''k1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'''
\set K2 '''k2-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'''
\set KA '''adm-cccccccccccccccccccccccccccccccccccccccc'''
insert into public.vz_admins (key_hash, note) values (vz_private.vz_hash(:KA), 'owner');
create or replace function pg_temp.expect_err(sql text, pat text) returns text language plpgsql as $$
begin execute sql; raise exception 'FAIL: expected error % for %', pat, sql;
exception when others then if sqlerrm ~* pat then return 'OK err: ' || sqlerrm; end if; raise exception 'FAIL: % (wanted %)', sqlerrm, pat; end $$;
grant execute on all functions in schema pg_temp to anon;
set role anon;
select 'ping', public.vz_ping();
select pg_temp.expect_err($$select vz_private.vz_hash('x')$$, 'permission denied');
select pg_temp.expect_err($$select * from public.vz_cards$$, 'permission denied');
select pg_temp.expect_err($$insert into public.vz_events(card_id,kind,device,day) values (gen_random_uuid(),'view','abcdefgh',current_date)$$, 'permission denied');
select pg_temp.expect_err($$select vz_private.vz_pub(null::public.vz_cards)$$, 'permission denied');
select pg_temp.expect_err($$select public.vz_save_card('short', '{"n":"X","p":"77010000000"}')$$, 'ключ');
select pg_temp.expect_err($$select public.vz_save_card('k1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '{"n":"","p":"77010000000"}')$$, 'имя');
select pg_temp.expect_err($$select public.vz_save_card('k1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '{"n":"A","p":"123"}')$$, 'Телефон');
select 'me none', public.vz_me(:K1);
select 'save1', r->>'pro', r->>'slug', r->'d' from (select public.vz_save_card(:K1, '{"n":"Аслан","p":"77015556677","c":"Газель","t":"Алматы","s":"013","hack":"x","i":"javascript:x"}', 'aslan', 'gazel', true) r) x;
select 'trial 7d', (public.vz_me(:K1)->>'pro_until')::timestamptz between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute';
select pg_temp.expect_err($$select public.vz_save_card('k1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '{"n":"A","p":"77015556677"}', 'admin')$$, 'занят системой');
select pg_temp.expect_err($$select public.vz_save_card('k1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '{"n":"A","p":"77015556677"}', 'a_b')$$, 'латиница');
select 'slug', public.vz_slug_free('aslan', :K1), public.vz_slug_free('aslan', :K2), public.vz_slug_free('aslan'), public.vz_slug_free('Admin'), public.vz_slug_free('ok-slug');
-- чужой ключ: тот же номер / тот же адрес
select pg_temp.expect_err($$select public.vz_save_card('k2-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '{"n":"Хакер","p":"77015556677"}')$$, 'номером уже есть');
select 'k2 save', public.vz_save_card(:K2, '{"n":"Болат","p":"77019999999","t":"Астана","s":"5"}', 'bolat', 'truck3', false)->>'slug';
select pg_temp.expect_err($$select public.vz_save_card('k2-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '{"n":"Болат","p":"77019999999"}', 'aslan')$$, 'занят');
select pg_temp.expect_err($$select public.vz_save_card('k2-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '{"n":"Болат","p":"77015556677"}')$$, 'другой визитке');
select pg_temp.expect_err($$select public.vz_admin_find('k2-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')$$, 'Нет прав');
select 'not admin', public.vz_is_admin(:K1), public.vz_is_admin(null);
-- публика
select 'card', public.vz_card('ASLAN')->'d'->>'n', public.vz_card('nope');
select 'no hash leak', public.vz_card('aslan')::text !~ 'key_hash|phone"', public.vz_catalog()::text !~ 'key_hash';
select 'catalog', jsonb_array_length(public.vz_catalog()), jsonb_array_length(public.vz_catalog('алма', 'gazel', 3)), jsonb_array_length(public.vz_catalog('', 'truck3')), jsonb_array_length(public.vz_catalog('', '', 5));
select public.vz_track('aslan', 'view', 'dev-aaaaaaaa'), public.vz_track('aslan', 'view', 'dev-aaaaaaaa'), public.vz_track('aslan', 'view', 'dev-bbbbbbbb'),
       public.vz_track('aslan', 'wa', 'dev-aaaaaaaa'), public.vz_track('aslan', 'call', 'dev-aaaaaaaa'), public.vz_track('aslan', 'hack', 'dev-aaaaaaaa'), public.vz_track('aslan', 'view', 'x');
select 'stats', public.vz_my_stats(:K1), public.vz_my_stats(:K2)->'d7', public.vz_my_stats('nokeynokeynokeynokeynokeynokeynokey');
select 'cities', public.vz_catalog_cities();
-- админ
select 'admin', public.vz_is_admin(:KA), jsonb_array_length(public.vz_admin_find(:KA, '701 555')), jsonb_array_length(public.vz_admin_find(:KA, '@')), jsonb_array_length(public.vz_admin_find(:KA, 'zzz'));
select 'extend 3', public.vz_admin_extend(:KA, (public.vz_admin_find(:KA, 'aslan')->0->>'id')::uuid, 3, 'Kaspi 4500')->>'is_paid';
select 'until 3m+7d', (public.vz_me(:K1)->>'pro_until')::timestamptz > now() + interval '3 months 6 days';
select pg_temp.expect_err($$select public.vz_admin_extend('adm-cccccccccccccccccccccccccccccccccccccccc', gen_random_uuid(), 5)$$, 'Срок');
select 'log', jsonb_array_length(public.vz_admin_log(:KA, (public.vz_admin_find(:KA, 'aslan')->0->>'id')::uuid));
select 'astats', public.vz_admin_stats(:KA);
select public.vz_admin_extend(:KA, (public.vz_admin_find(:KA, 'aslan')->0->>'id')::uuid, 0, 'отмена') is not null;
-- Про закончился
select 'expired', public.vz_card('aslan')->>'pro', public.vz_card('aslan')->>'n' is null, jsonb_array_length(public.vz_catalog());
select pg_temp.expect_err($$select public.vz_save_card('k1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '{"n":"A","p":"77015556677"}', 'aslan2')$$, 'функция Про');
select 'save ok expired', public.vz_save_card(:K1, '{"n":"Аслан Б","p":"77015556677"}')->'d'->>'n';
select public.vz_track('aslan', 'view', 'dev-cccccccc'); select 'no track expired', public.vz_my_stats(:K1)->'d7'->>'view';
-- блок и удаление
select public.vz_admin_extend(:KA, (public.vz_admin_find(:KA, 'aslan')->0->>'id')::uuid, 1, ''), public.vz_admin_block(:KA, (public.vz_admin_find(:KA, 'aslan')->0->>'id')::uuid, true);
select 'blocked', public.vz_card('aslan') is null, jsonb_array_length(public.vz_catalog());
select 'delete own', public.vz_delete_card(:K2), public.vz_me(:K2);
select public.vz_admin_delete(:KA, (public.vz_admin_find(:KA, 'aslan')->0->>'id')::uuid);
select 'after admin delete', jsonb_array_length(public.vz_admin_find(:KA, ''));

-- v6: приглашения, оплата, списки, превью
\set K3 '''k3-ddddddddddddddddddddddddddddddddddddddddd'''
\set K4 '''k4-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'''
select 'ref1', (public.vz_save_card(:K1, '{"n":"Реф","p":"77011110000"}', 'refer') ->> 'ref_code') ~ '^[0-9a-f]{8}$';
select set_config('vz.ref', public.vz_me(:K1)->>'ref_code', false);
select set_config('vz.until0', public.vz_me(:K1)->>'pro_until', false);
select 'invited', public.vz_save_card(:K3, '{"n":"Новый","p":"77012220000"}', null, '', true, current_setting('vz.ref')) ->> 'pro';
select 'ref +7d', (public.vz_me(:K1)->>'pro_until')::timestamptz - current_setting('vz.until0')::timestamptz between interval '6 days 23 hours' and interval '7 days 1 minute', public.vz_me(:K1)->>'ref_count';
-- тот же номер заново (удалить и создать) — второй награды нет
select public.vz_delete_card(:K3);
select set_config('vz.until1', public.vz_me(:K1)->>'pro_until', false);
select public.vz_save_card(:K4, '{"n":"Новый2","p":"77012220000"}', null, '', true, current_setting('vz.ref')) is not null;
select 'no double reward', public.vz_me(:K1)->>'pro_until' = current_setting('vz.until1');
select 'bad ref ignored', public.vz_save_card('k5-fffffffffffffffffffffffffffffffffffffffff', '{"n":"Без","p":"77013330000"}', null, '', true, 'zzzz') is not null;
select 'self ref ignored', public.vz_save_card(:K1, '{"n":"Реф","p":"77011110000"}', null, '', true, current_setting('vz.ref'))->>'ref_count';
-- оплата
select pg_temp.expect_err($$select public.vz_pay_request('nokeynokeynokeynokeynokeynokeynokey', 1)$$, 'Сначала');
select 'pay', public.vz_pay_request(:K4, 3), public.vz_pay_request(:K4, 1), public.vz_me(:K4)->>'pay_pending';
select pg_temp.expect_err($$select public.vz_admin_lists('k2-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')$$, 'Нет прав');
select 'lists', jsonb_array_length(public.vz_admin_lists(:KA)->'requests'), public.vz_admin_lists(:KA)->'requests'->0->>'req_months';
select public.vz_admin_extend(:KA, (public.vz_admin_lists(:KA)->'requests'->0->>'id')::uuid, 1, 'kaspi') is not null;
select 'req closed', jsonb_array_length(public.vz_admin_lists(:KA)->'requests'), public.vz_me(:K4)->>'pay_pending';
select public.vz_pay_request(:K4, 1); select public.vz_admin_dismiss(:KA, (public.vz_admin_lists(:KA)->'requests'->0->>'req_id')::bigint);
select 'dismissed', jsonb_array_length(public.vz_admin_lists(:KA)->'requests');
select 'expiring', jsonb_array_length(public.vz_admin_lists(:KA)->'expiring');
-- превью: без токена нельзя
select pg_temp.expect_err($$select public.vz_og_list('nokeynokeynokeynokeynokeynokeynokey')$$, 'Нет прав');
reset role;
insert into public.vz_settings values ('og_token_hash', vz_private.vz_hash('ogtoken-ooooooooooooooooooooooooooooooooooo'));
set role anon;
select 'og', jsonb_array_length(public.vz_og_list('ogtoken-ooooooooooooooooooooooooooooooooooo')), public.vz_og_list('ogtoken-ooooooooooooooooooooooooooooooooooo')->0->>'slug';
select 'reserved tools', public.vz_slug_free('tools');
reset role;
select 'ALL DONE';
