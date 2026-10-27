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
-- ключ из админки
select pg_temp.expect_err($$select public.vz_admin_issue_key('k2-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', gen_random_uuid())$$, 'Нет прав');
select set_config('vz.nk', public.vz_admin_issue_key(:KA, (public.vz_admin_find(:KA, 'Новый2')->0->>'id')::uuid), false);
select 'issued', length(current_setting('vz.nk')), public.vz_me(current_setting('vz.nk'))->>'pro', public.vz_me(:K4) is null;
reset role;
update public.vz_cards set pro_until = '2099-12-31' where key_hash = vz_private.vz_hash(current_setting('vz.nk'));
set role anon;
select 'lifetime', public.vz_me(current_setting('vz.nk'))->>'lifetime';
-- v7: статус
select 'slug', public.vz_save_card(current_setting('vz.nk'), public.vz_me(current_setting('vz.nk'))->'d', 'testrev')->>'slug';
select pg_temp.expect_err($$select public.vz_set_status('nokeynokeynokeynokeynokeynokeynokey', 'free')$$, 'Сначала');
select pg_temp.expect_err($$select public.vz_set_status(current_setting('vz.nk'), 'sleep')$$, 'Статус');
select 'free', public.vz_set_status(current_setting('vz.nk'), 'free')->>'s';
select 'busy', public.vz_set_status(current_setting('vz.nk'), 'busy', 60)->>'s', (public.vz_card(public.vz_me(current_setting('vz.nk'))->>'slug')->'status'->>'until') is not null;
select 'free first', public.vz_catalog('', '', null, 60, 0, true) = '[]'::jsonb;
reset role;
update public.vz_cards set busy_until = now() - interval '1 minute' where key_hash = vz_private.vz_hash(current_setting('vz.nk'));
set role anon;
select 'auto free', public.vz_me(current_setting('vz.nk'))->'status'->>'s';
reset role;
update public.vz_cards set status_at = now() - interval '2 days', busy_until = null where key_hash = vz_private.vz_hash(current_setting('vz.nk'));
set role anon;
select 'stale', public.vz_me(current_setting('vz.nk'))->>'status' is null;
select 'rt', public.vz_save_card(current_setting('vz.nk'), (public.vz_me(current_setting('vz.nk'))->'d') || '{"rt":"6000,150,,3000,1000,"}')->'d'->>'rt';
select 'rt bad', public.vz_save_card(current_setting('vz.nk'), (public.vz_me(current_setting('vz.nk'))->'d') || '{"rt":"<b>"}')->'d'->>'rt' is null;
-- v7: отзывы (по умолчанию выключены)
select pg_temp.expect_err($$select public.vz_review_invite(current_setting('vz.nk'))$$, 'отключены');
select pg_temp.expect_err($$select public.vz_review_submit('testrev', 5, 'x', 'A', 'dev-zzzzzzzz')$$, 'отключены');
reset role;
insert into public.vz_settings values ('reviews_enabled', 'true') on conflict (key) do update set value = 'true';
set role anon;
select set_config('vz.slug', public.vz_me(current_setting('vz.nk'))->>'slug', false);
select set_config('vz.tok', public.vz_review_invite(current_setting('vz.nk')), false);
select 'invite', length(current_setting('vz.tok')), public.vz_review_invite_info(current_setting('vz.tok'))->>'valid';
select pg_temp.expect_err($$select public.vz_review_submit('', 6, '', 'A', 'dev-aaaaaaaa', current_setting('vz.tok'))$$, 'оценку');
select 'inv submit', public.vz_review_submit('', 5, 'Отлично довёз, аккуратно!', 'Мария Иванова 8701', 'dev-aaaaaaaa', current_setting('vz.tok'));
select pg_temp.expect_err($$select public.vz_review_submit('', 5, '', 'A', 'dev-aaaaaaaa', current_setting('vz.tok'))$$, 'уже');
select 'pub', public.vz_reviews(current_setting('vz.slug'))->0->>'author', public.vz_card(current_setting('vz.slug'))->'rating';
select 'open', public.vz_review_submit(current_setting('vz.slug'), 4, 'норм', 'Пётр', 'dev-bbbbbbbb');
select pg_temp.expect_err($$select public.vz_review_submit(current_setting('vz.slug'), 4, 'ещё', 'Пётр', 'dev-bbbbbbbb')$$, 'уже');
select set_config('vz.tok2', public.vz_review_invite(current_setting('vz.nk')), false);
select 'filtered', public.vz_review_submit('', 1, 'звоните 8 701 123 45 67', 'Зло', 'dev-cccccccc', current_setting('vz.tok2'));
reset role;
select 'flag', vz_private.vz_review_flag('см. www.site.kz'), vz_private.vz_review_flag('ты сука'), vz_private.vz_review_flag('за 15000 тенге, 3 часа') = '';
set role anon;
select 'count pub', jsonb_array_length(public.vz_reviews(current_setting('vz.slug'), 50));
select 'my', public.vz_my_reviews(current_setting('vz.nk'))->>'pending';
select set_config('vz.rid', public.vz_reviews(current_setting('vz.slug'))->0->>'id', false);
select 'reply', public.vz_review_reply(current_setting('vz.nk'), current_setting('vz.rid')::bigint, 'Спасибо!');
select pg_temp.expect_err($$select public.vz_review_reply(current_setting('vz.nk'), current_setting('vz.rid')::bigint, 'Ещё')$$, 'уже');
select pg_temp.expect_err($$select public.vz_review_reply('k1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', current_setting('vz.rid')::bigint, 'Чужой')$$, 'уже');
select 'complain', public.vz_review_complain(current_setting('vz.rid')::bigint, 'неправда', 'dev-1111111'||g) from generate_series(1,3) g;
select 'hidden by complaints', jsonb_array_length(public.vz_reviews(current_setting('vz.slug'), 50));
select pg_temp.expect_err($$select public.vz_admin_reviews('k2-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')$$, 'Нет прав');
select 'admin list', jsonb_array_length(public.vz_admin_reviews(:KA));
select 'restore', public.vz_admin_review_set(:KA, current_setting('vz.rid')::bigint, 'pub'), jsonb_array_length(public.vz_reviews(current_setting('vz.slug'), 50));
select 'approve all', count(public.vz_admin_review_set(:KA, (x->>'id')::bigint, 'pub')) from jsonb_array_elements(public.vz_admin_reviews(:KA)) x;
select 'rating', public.vz_card(current_setting('vz.slug'))->'rating';
select pg_temp.expect_err($$select count(*) from public.vz_reviews$$, 'permission');
reset role;
update public.vz_settings set value = 'false' where key = 'reviews_enabled';
set role anon;
select 'off: hidden', public.vz_card(current_setting('vz.slug'))->'rating' = 'null'::jsonb, public.vz_reviews(current_setting('vz.slug')) = '[]'::jsonb, public.vz_my_reviews(current_setting('vz.nk')) is null;
reset role;
update public.vz_settings set value = 'true' where key = 'reviews_enabled';
set role anon;
-- v8: заказы
\set D1 '''dev-1111111111111111111111111111111111'''
\set D2 '''dev-2222222222222222222222222222222222'''
select pg_temp.expect_err($$select public.vz_order_create('dev-1111111111111111111111111111111111', '{"what":"Диван"}')$$, 'телефон');
select pg_temp.expect_err($$select public.vz_order_create('dev-1111111111111111111111111111111111', '{"what":"см. www.x.kz","phone":"87011234567"}')$$, 'ссылки');
select set_config('vz.o1', public.vz_order_create(:D1, '{"what":"Диван","from":"Абая 1","to":"Сатпаева 5","phone":"8 701 123 45 67","name":"Айгерим К","calc":{"km":12,"lo":9000,"hi":11000,"a":{"lat":43.2,"lon":76.9,"x":"bad"},"evil":"x"}}')::text, false);
select set_config('vz.o2', public.vz_order_create(:D1, '{"what":"Шкаф","phone":"77012223344"}', array[current_setting('vz.slug')])::text, false);
select set_config('vz.o3', public.vz_order_create(:D2, '{"what":"Мусор","phone":"77015556600"}', array['refer'])::text, false);
select 'feed', jsonb_array_length(public.vz_feed(current_setting('vz.nk'))), public.vz_feed(current_setting('vz.nk'))->0->>'personal', public.vz_feed(current_setting('vz.nk'))->0->>'phone' is null;
select 'calc clean', public.vz_my_orders(:D1)->1->'calc';
select 'no phone in feed', bool_and(x->>'phone' is null) from jsonb_array_elements(public.vz_feed(current_setting('vz.nk'))) x;
select pg_temp.expect_err($$select public.vz_order_respond(current_setting('vz.nk'), current_setting('vz.o3')::uuid)$$, 'другим');
select 'respond', public.vz_order_respond(current_setting('vz.nk'), current_setting('vz.o1')::uuid, 10000, 'Буду через 30 минут')->>'phone';
select 'phone after respond', (select x->>'phone' from jsonb_array_elements(public.vz_feed(current_setting('vz.nk'))) x where x->>'id' = current_setting('vz.o1'));
select 'my orders', jsonb_array_length(public.vz_my_orders(:D1)), (public.vz_my_orders(:D1)->1->'responses'->0->>'price'), public.vz_my_orders(:D2)->0->'targets';
select pg_temp.expect_err($$select public.vz_order_pick('dev-2222222222222222222222222222222222', current_setting('vz.o1')::uuid, current_setting('vz.slug'))$$, 'закрыт');
select pg_temp.expect_err($$select public.vz_order_review('dev-1111111111111111111111111111111111', current_setting('vz.o1')::uuid)$$, 'после');
select 'pick', public.vz_order_pick(:D1, current_setting('vz.o1')::uuid, current_setting('vz.slug'));
select 'taken', public.vz_my_orders(:D1)->1->>'state', public.vz_my_orders(:D1)->1->>'taken';
select 'feed mine', (select x->>'mine' from jsonb_array_elements(public.vz_feed(current_setting('vz.nk'))) x where x->>'id' = current_setting('vz.o1'));
select 'review tok', length(public.vz_order_review(:D1, current_setting('vz.o1')::uuid)->>'token');
select pg_temp.expect_err($$select public.vz_order_review('dev-1111111111111111111111111111111111', current_setting('vz.o1')::uuid)$$, 'уже');
select 'cancel', public.vz_order_cancel(:D1, current_setting('vz.o2')::uuid), jsonb_array_length(public.vz_feed(current_setting('vz.nk')));
select 'rate', public.vz_order_create(:D2, '{"what":"x","phone":"77015556600"}') is not null from generate_series(1,4);
select pg_temp.expect_err($$select public.vz_order_create('dev-2222222222222222222222222222222222', '{"what":"x","phone":"77015556600"}')$$, '5 заказов');
select 'admin orders', jsonb_array_length(public.vz_admin_orders(:KA));
select 'block', public.vz_admin_order_set(:KA, current_setting('vz.o3')::uuid, null, true);
select pg_temp.expect_err($$select public.vz_order_create('dev-2222222222222222222222222222222222', '{"what":"x","phone":"77015556600"}')$$, 'отключены');
select pg_temp.expect_err($$select count(*) from public.vz_orders$$, 'permission');
reset role;
select 'ALL DONE';
