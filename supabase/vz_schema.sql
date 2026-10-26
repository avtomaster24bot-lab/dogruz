-- =====================================================================
--  ВЕЗУ Про — схема для Supabase (отдельный проект VEZU).
--  Supabase → SQL Editor → вставить целиком → Run. Повторный запуск безопасен.
--  Всё с префиксом vz_. RLS включён на всех таблицах, политик для клиентов нет:
--  читать и писать можно только через функции vz_* ниже.
--
--  Вход без регистрации: при первом сохранении телефон водителя создаёт случайный
--  «ключ доступа» (256 бит) и хранит его у себя. В базе — только SHA-256 ключа.
--  Ключ = пароль от визитки: им же визитка переносится на новый телефон.
--  Админ — тоже по ключу: в vz_admins хранится SHA-256 ключа владельца.
-- =====================================================================

-- Функции с правами владельца (security definer) живут в схеме vz_private, которую API не публикует.
-- Наружу (в public) смотрят только тонкие обёртки security invoker — см. «API» ниже.
create schema if not exists vz_private;
revoke all on schema vz_private from public;
grant usage on schema vz_private to anon, authenticated;

create or replace function vz_private.vz_hash(p_key text) returns text
language sql immutable set search_path = '' as $$
  select case when coalesce(p_key, '') ~ '^[A-Za-z0-9_-]{32,64}$' then encode(sha256(convert_to(p_key, 'UTF8')), 'hex') end;
$$;

-- ---------- таблицы ----------
create table if not exists public.vz_cards (
  id           uuid primary key default gen_random_uuid(),
  key_hash     text not null unique,
  slug         text unique check (slug is null or slug ~ '^[a-z0-9]([a-z0-9-]{1,18})[a-z0-9]$'),
  phone        text not null unique check (phone ~ '^7[0-9]{10}$'),
  data         jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 3000),
  city         text not null default '',
  veh          text not null default '' check (veh in ('', 'kabluk', 'gazel', 'gazel-long', 'truck3')),
  photo_path   text,
  is_published boolean not null default true,     -- показывать в каталоге (решает водитель)
  is_blocked   boolean not null default false,    -- скрыть везде (решает админ)
  pro_until    timestamptz,
  is_paid      boolean not null default false,    -- был хоть один оплаченный период
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists vz_cards_catalog on public.vz_cards (is_paid desc, updated_at desc) where is_published and not is_blocked;
create index if not exists vz_cards_created on public.vz_cards (created_at);

create table if not exists public.vz_events (
  id      bigserial primary key,
  card_id uuid not null references public.vz_cards(id) on delete cascade,
  kind    text not null check (kind in ('view', 'wa', 'call')),
  device  text not null,
  day     date not null,
  created_at timestamptz not null default now(),
  unique (card_id, kind, device, day)              -- одно событие каждого типа с устройства в день
);
create index if not exists vz_events_card_day on public.vz_events (card_id, day);
create index if not exists vz_events_day on public.vz_events (day);

create table if not exists public.vz_admins (
  key_hash text primary key,
  note     text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.vz_pro_log (
  id        bigserial primary key,
  card_id   uuid not null references public.vz_cards(id) on delete cascade,
  months    int not null,
  pro_until timestamptz,
  note      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists vz_pro_log_card on public.vz_pro_log (card_id);

-- v6: приглашения, заявки на оплату, превью ссылок
alter table public.vz_cards add column if not exists ref_code text unique;
alter table public.vz_cards add column if not exists referred_by uuid references public.vz_cards(id) on delete set null;
alter table public.vz_cards add column if not exists photo_og text;     -- JPEG-копия фото для превью ссылок
create index if not exists vz_cards_referred_by on public.vz_cards (referred_by);

-- одна награда за приглашение на номер телефона — навсегда (даже если визитку удалят и создадут снова)
create table if not exists public.vz_ref_log (
  phone      text primary key,
  referrer   uuid references public.vz_cards(id) on delete set null,
  new_card   uuid references public.vz_cards(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vz_ref_log_referrer on public.vz_ref_log (referrer);
create index if not exists vz_ref_log_new_card on public.vz_ref_log (new_card);

create table if not exists public.vz_pay_requests (
  id         bigserial primary key,
  card_id    uuid not null references public.vz_cards(id) on delete cascade,
  months     int not null default 1 check (months in (1, 3, 6, 12)),
  status     text not null default 'new' check (status in ('new', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);
create index if not exists vz_pay_requests_open on public.vz_pay_requests (card_id) where status = 'new';

create table if not exists public.vz_settings (key text primary key, value text not null);

alter table public.vz_ref_log      enable row level security;
alter table public.vz_pay_requests enable row level security;
alter table public.vz_settings     enable row level security;
revoke all on public.vz_ref_log, public.vz_pay_requests, public.vz_settings from anon, authenticated;
revoke all on sequence public.vz_pay_requests_id_seq from anon, authenticated;

alter table public.vz_cards   enable row level security;
alter table public.vz_events  enable row level security;
alter table public.vz_admins  enable row level security;
alter table public.vz_pro_log enable row level security;
revoke all on public.vz_cards, public.vz_events, public.vz_admins, public.vz_pro_log from anon, authenticated;
revoke all on sequence public.vz_events_id_seq, public.vz_pro_log_id_seq from anon, authenticated;

-- ---------- вспомогательные ----------
create or replace function vz_private.vz_slug_check(p_slug text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_slug is null or p_slug !~ '^[a-z0-9]([a-z0-9-]{1,18})[a-z0-9]$' or p_slug like '%--%' then 'bad'
    when p_slug = any (array['admin','api','app','about','assets','auth','card','catalog','css','d','demo','edit',
      'help','icons','img','index','js','kaspi','login','logout','manifest','me','new','null','owner','pay','pro',
      'root','settings','stats','static','support','sw','tarify','telegram','test','undefined','vezu','whatsapp',
      'www','404','supabase','tests','user','driver','drivers','order','orders','info','privacy','terms',
      'tools','github','og','p','ref','pay','price','help-me']) then 'reserved'
    else 'ok' end;
$$;

create or replace function public.vz_ping() returns int language sql stable set search_path = '' as $$ select 3 $$;

create or replace function vz_private.vz_pub(c public.vz_cards) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('slug', c.slug, 'd', c.data, 'photo', c.photo_path,
    'pro', coalesce(c.pro_until > now(), false), 'paid', c.is_paid, 'updated_at', c.updated_at,
    'lifetime', coalesce(c.pro_until > now() + interval '50 years', false));
$$;
create or replace function vz_private.vz_priv(c public.vz_cards) returns jsonb
language sql stable set search_path = '' as $$
  select vz_private.vz_pub(c) || jsonb_build_object('pro_until', c.pro_until, 'is_published', c.is_published, 'is_blocked', c.is_blocked,
    'ref_code', c.ref_code, 'ref_count', (select count(*) from public.vz_ref_log r where r.referrer = c.id),
    'pay_pending', exists (select 1 from public.vz_pay_requests q where q.card_id = c.id and q.status = 'new'));
$$;

create or replace function vz_private.vz_is_admin(p_admin text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.vz_admins where key_hash = vz_private.vz_hash(p_admin));
$$;

-- ---------- водитель (по ключу доступа) ----------
create or replace function vz_private.vz_me(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select vz_private.vz_priv(c) from public.vz_cards c where c.key_hash = vz_private.vz_hash(p_key);
$$;

create or replace function vz_private.vz_slug_free(p_slug text, p_key text default null) returns text
language plpgsql stable security definer set search_path = '' as $$
declare s text := lower(trim(coalesce(p_slug, ''))); h text; chk text;
begin
  chk := vz_private.vz_slug_check(s);
  if chk <> 'ok' then return chk; end if;
  select key_hash into h from public.vz_cards where slug = s;
  if h is null then return 'ok'; end if;
  return case when h = vz_private.vz_hash(p_key) then 'mine' else 'taken' end;
end $$;

-- Сохранить визитку. Первое сохранение создаёт её и включает Про на 7 дней (пробный период).
-- p_slug: null — не менять, '' — убрать.
drop function if exists public.vz_save_card(text, jsonb, text, text, boolean);
drop function if exists vz_private.vz_save_card(text, jsonb, text, text, boolean);
-- p_ref: код пригласившего водителя (только для новой визитки, один раз на номер телефона): ему +7 дней Про.
create or replace function vz_private.vz_save_card(p_key text, p_data jsonb, p_slug text default null, p_veh text default '',
  p_published boolean default true, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h text := vz_private.vz_hash(p_key); c public.vz_cards; d jsonb := '{}'::jsonb; k text; s text; pro boolean; rid uuid;
begin
  if h is null then raise exception 'Неверный ключ доступа'; end if;
  if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Нет данных визитки'; end if;
  foreach k in array array['n','p','c','w','t','s','m','pr','pu','hs','he','tg','z','f','th','i'] loop
    if p_data ? k then d := d || jsonb_build_object(k, p_data->k); end if;
  end loop;
  if length(trim(coalesce(d->>'n', ''))) not between 1 and 40 then raise exception 'Укажите имя (до 40 символов)'; end if;
  if coalesce(d->>'p', '') !~ '^7[0-9]{10}$' then raise exception 'Телефон в формате +7 7XX XXX XX XX'; end if;
  if d ? 'i' and coalesce(d->>'i', '') !~ '^https://' then d := d - 'i'; end if;
  if octet_length(d::text) > 2500 then raise exception 'Слишком длинный текст'; end if;
  if coalesce(p_veh, '') not in ('', 'kabluk', 'gazel', 'gazel-long', 'truck3') then p_veh := ''; end if;

  select * into c from public.vz_cards where key_hash = h for update;
  if c.id is not null and c.ref_code is null then
    update public.vz_cards set ref_code = substr(md5(random()::text || clock_timestamp()::text || h), 1, 8) where id = c.id returning * into c;
  end if;
  if c.id is null then
    if (select count(*) from public.vz_cards where created_at > now() - interval '1 hour') >= 60 then
      raise exception 'Слишком много новых визиток, попробуйте через час';
    end if;
    if exists (select 1 from public.vz_cards where phone = d->>'p') then
      raise exception 'Визитка с этим номером уже есть в облаке. Откройте её ключом доступа или напишите в поддержку ВЕЗУ';
    end if;
    insert into public.vz_cards (key_hash, phone, data, city, veh, is_published, pro_until, ref_code)
    values (h, d->>'p', d, left(trim(coalesce(d->>'t', '')), 60), coalesce(p_veh, ''), coalesce(p_published, true), now() + interval '7 days',
            substr(md5(random()::text || clock_timestamp()::text || h), 1, 8))
    returning * into c;
    -- приглашение: награда пригласившему, если номер раньше не участвовал
    if coalesce(p_ref, '') ~ '^[0-9a-f]{8}$' then
      select id into rid from public.vz_cards where ref_code = p_ref and id <> c.id and not is_blocked;
      if rid is not null and not exists (select 1 from public.vz_ref_log where phone = c.phone) then
        insert into public.vz_ref_log (phone, referrer, new_card) values (c.phone, rid, c.id);
        update public.vz_cards set pro_until = greatest(coalesce(pro_until, now()), now()) + interval '7 days' where id = rid;
        update public.vz_cards set referred_by = rid where id = c.id returning * into c;
      end if;
    end if;
  else
    if exists (select 1 from public.vz_cards where phone = d->>'p' and id <> c.id) then
      raise exception 'Этот номер уже привязан к другой визитке в облаке';
    end if;
    update public.vz_cards set data = d, phone = d->>'p', city = left(trim(coalesce(d->>'t', '')), 60), veh = coalesce(p_veh, ''),
      is_published = coalesce(p_published, is_published), updated_at = now()
    where id = c.id returning * into c;
  end if;
  pro := c.pro_until > now();

  if p_slug is not null then
    s := lower(trim(p_slug));
    if s = '' then
      update public.vz_cards set slug = null where id = c.id returning * into c;
    elsif s is distinct from c.slug then
      if not pro then raise exception 'Короткий адрес — функция Про'; end if;
      if vz_private.vz_slug_check(s) = 'reserved' then raise exception 'Этот адрес занят системой, выберите другой'; end if;
      if vz_private.vz_slug_check(s) <> 'ok' then raise exception 'Адрес: латиница, цифры и дефис, 3–20 символов'; end if;
      if exists (select 1 from public.vz_cards where slug = s and id <> c.id) then raise exception 'Адрес уже занят'; end if;
      update public.vz_cards set slug = s where id = c.id returning * into c;
    end if;
  end if;
  return vz_private.vz_priv(c);
exception when unique_violation then raise exception 'Адрес или номер уже заняты';
end $$;

create or replace function vz_private.vz_delete_card(p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.vz_cards where key_hash = vz_private.vz_hash(p_key);
  return found;
end $$;

create or replace function vz_private.vz_my_stats(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with c as (select id from public.vz_cards where key_hash = vz_private.vz_hash(p_key)),
  t as (select (now() at time zone 'Asia/Almaty')::date as today)
  select case when not exists (select 1 from c) then null else jsonb_build_object(
    'd7', (select jsonb_build_object('view', count(*) filter (where kind = 'view'), 'wa', count(*) filter (where kind = 'wa'), 'call', count(*) filter (where kind = 'call'))
      from public.vz_events e, t where e.card_id in (select id from c) and e.day > t.today - 7),
    'd30', (select jsonb_build_object('view', count(*) filter (where kind = 'view'), 'wa', count(*) filter (where kind = 'wa'), 'call', count(*) filter (where kind = 'call'))
      from public.vz_events e, t where e.card_id in (select id from c) and e.day > t.today - 30)) end;
$$;

-- ---------- публичные ----------
-- Визитка по короткому адресу. После окончания Про адрес продолжает открываться
-- (чтобы не сломались напечатанные QR), но без Про-функций (фото, каталог, статистика).
create or replace function vz_private.vz_card(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select vz_private.vz_pub(c) || case when c.pro_until > now() then '{}'::jsonb else '{"photo":null}'::jsonb end
  from public.vz_cards c where c.slug = lower(trim(p_slug)) and not c.is_blocked;
$$;

create or replace function vz_private.vz_catalog(p_city text default '', p_veh text default '', p_service int default null,
  p_limit int default 60, p_offset int default 0) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.is_paid desc, x.updated_at desc), '[]'::jsonb) from (
    select vz_private.vz_pub(c) as j, c.is_paid, c.updated_at from public.vz_cards c
    where c.is_published and not c.is_blocked and c.slug is not null and c.pro_until > now()
      and (coalesce(p_city, '') = '' or lower(c.city) like '%' || lower(trim(p_city)) || '%')
      and (coalesce(p_veh, '') = '' or c.veh = p_veh)
      and (p_service is null or position(p_service::text in coalesce(c.data->>'s', '')) > 0)
    order by c.is_paid desc, c.updated_at desc
    limit least(greatest(coalesce(p_limit, 60), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) x;
$$;

create or replace function vz_private.vz_catalog_cities() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct c.city order by c.city), '{}') from public.vz_cards c
  where c.is_published and not c.is_blocked and c.slug is not null and c.pro_until > now() and c.city <> '';
$$;

-- Счётчик: просмотр / WhatsApp / звонок. Одно событие каждого типа с устройства в день.
create or replace function vz_private.vz_track(p_slug text, p_kind text, p_device text) returns void
language plpgsql security definer set search_path = '' as $$
declare cid uuid; today date := (now() at time zone 'Asia/Almaty')::date;
begin
  if p_kind not in ('view', 'wa', 'call') or coalesce(p_device, '') !~ '^[A-Za-z0-9_-]{8,40}$' then return; end if;
  select id into cid from public.vz_cards where slug = lower(trim(p_slug)) and pro_until > now() and not is_blocked;
  if cid is null then return; end if;
  if (select count(*) from public.vz_events where card_id = cid and day = today) >= 5000 then return; end if;
  insert into public.vz_events (card_id, kind, device, day) values (cid, p_kind, p_device, today) on conflict do nothing;
end $$;

-- ---------- админ (по ключу админа) ----------
create or replace function vz_private.vz_admin_row(c public.vz_cards) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'slug', c.slug, 'n', c.data->>'n', 'p', c.phone, 'c', c.data->>'c', 'tg', c.data->>'tg',
    'city', c.city, 'pro_until', c.pro_until, 'is_paid', c.is_paid, 'is_published', c.is_published,
    'is_blocked', c.is_blocked, 'created_at', c.created_at, 'photo', c.photo_path,
    'refs', (select count(*) from public.vz_ref_log r where r.referrer = c.id),
    'lifetime', coalesce(c.pro_until > now() + interval '50 years', false),
    'views30', (select count(*) from public.vz_events e where e.card_id = c.id and e.kind = 'view' and e.day > current_date - 30));
$$;

create or replace function vz_private.vz_admin_find(p_admin text, p_q text default '') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := trim(coalesce(p_q, '')); dig text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(j order by created_at desc), '[]'::jsonb) from (
    select vz_private.vz_admin_row(c) j,
      c.created_at
    from public.vz_cards c
    where q = '' or c.data->>'n' ilike '%' || q || '%' or c.slug ilike '%' || q || '%'
       or c.data->>'tg' ilike '%' || ltrim(q, '@') || '%' or c.city ilike '%' || q || '%'
       or (length(dig) >= 4 and c.phone like '%' || dig || '%')
    order by c.created_at desc limit 100) s);
end $$;

-- Продлить Про на p_months (1/3/6/12) после оплаты. 0 — отключить Про сейчас.
create or replace function vz_private.vz_admin_extend(p_admin text, p_card uuid, p_months int, p_note text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.vz_cards;
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  if p_months not in (0, 1, 3, 6, 12) then raise exception 'Срок: 1, 3, 6 или 12 месяцев'; end if;
  update public.vz_cards set
    pro_until = case when p_months = 0 then now() else greatest(coalesce(pro_until, now()), now()) + make_interval(months => p_months) end,
    is_paid = is_paid or p_months > 0
  where id = p_card returning * into c;
  if c.id is null then raise exception 'Визитка не найдена'; end if;
  insert into public.vz_pro_log (card_id, months, pro_until, note) values (c.id, p_months, c.pro_until, left(coalesce(p_note, ''), 200));
  if p_months > 0 then
    update public.vz_pay_requests set status = 'done', closed_at = now() where card_id = c.id and status = 'new';
  end if;
  return jsonb_build_object('id', c.id, 'pro_until', c.pro_until, 'is_paid', c.is_paid);
end $$;

create or replace function vz_private.vz_admin_block(p_admin text, p_card uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  update public.vz_cards set is_blocked = p_blocked where id = p_card;
end $$;

-- Удалить визитку (например, если номер занял не тот человек). Водитель сможет создать её заново.
create or replace function vz_private.vz_admin_delete(p_admin text, p_card uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  delete from public.vz_cards where id = p_card;
end $$;

create or replace function vz_private.vz_admin_log(p_admin text, p_card uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(l) order by l.id desc), '[]'::jsonb) from public.vz_pro_log l where l.card_id = p_card);
end $$;

create or replace function vz_private.vz_admin_stats(p_admin text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  return jsonb_build_object(
    'cards', (select count(*) from public.vz_cards),
    'pro', (select count(*) from public.vz_cards where pro_until > now()),
    'paid', (select count(*) from public.vz_cards where pro_until > now() and is_paid),
    'trial', (select count(*) from public.vz_cards where pro_until > now() and not is_paid),
    'views7', (select count(*) from public.vz_events where kind = 'view' and day > current_date - 7));
end $$;

-- ---------- v6: оплата, списки админа, превью ссылок ----------
-- Водитель нажал «Я оплатил» — заявка для админа (одна открытая заявка на визитку).
create or replace function vz_private.vz_pay_request(p_key text, p_months int default 1) returns boolean
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if p_months not in (1, 3, 6, 12) then raise exception 'Срок: 1, 3, 6 или 12 месяцев'; end if;
  select id into cid from public.vz_cards where key_hash = vz_private.vz_hash(p_key);
  if cid is null then raise exception 'Сначала сохраните визитку в облаке'; end if;
  update public.vz_pay_requests set months = p_months, created_at = now() where card_id = cid and status = 'new';
  if not found then insert into public.vz_pay_requests (card_id, months) values (cid, p_months); end if;
  return true;
end $$;

-- Заявки на продление и визитки, у которых Про скоро закончится (≤ 3 дня) или закончился за последние 7 дней.
create or replace function vz_private.vz_admin_lists(p_admin text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  return jsonb_build_object(
    'requests', (select coalesce(jsonb_agg(vz_private.vz_admin_row(c) || jsonb_build_object('req_id', q.id, 'req_months', q.months, 'req_at', q.created_at)
                   order by q.created_at), '[]'::jsonb)
                 from public.vz_pay_requests q join public.vz_cards c on c.id = q.card_id where q.status = 'new'),
    'expiring', (select coalesce(jsonb_agg(vz_private.vz_admin_row(c) order by c.pro_until), '[]'::jsonb)
                 from public.vz_cards c where c.pro_until between now() - interval '7 days' and now() + interval '3 days' and not c.is_blocked));
end $$;

-- Новый ключ доступа к визитке для этого устройства (открыть кабинет водителя из админки).
-- В базе — только SHA-256; прежний ключ визитки перестаёт работать.
create or replace function vz_private.vz_admin_issue_key(p_admin text, p_card uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare k text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  update public.vz_cards set key_hash = vz_private.vz_hash(k) where id = p_card;
  if not found then raise exception 'Визитка не найдена'; end if;
  return k;
end $$;

create or replace function vz_private.vz_admin_dismiss(p_admin text, p_req bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  update public.vz_pay_requests set status = 'dismissed', closed_at = now() where id = p_req and status = 'new';
end $$;

-- Данные для статических страниц-превью …/dogruz/<адрес>/ (их собирает GitHub Actions по токену из vz_settings).
create or replace function vz_private.vz_og_list(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(vz_private.vz_hash(p_token), '-') is distinct from (select value from public.vz_settings where key = 'og_token_hash') then
    raise exception 'Нет прав' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'n', c.data->>'n', 'c', c.data->>'c', 'w', c.data->>'w',
      't', c.data->>'t', 'pr', c.data->>'pr', 'pu', c.data->>'pu', 'veh', c.veh, 'p', c.phone,
      'photo', case when c.pro_until > now() then c.photo_og end) order by c.slug), '[]'::jsonb)
    from public.vz_cards c where c.slug is not null and not c.is_blocked);
end $$;

-- ---------- API: обёртки в public (security invoker) ----------
-- старые версии (security definer прямо в public) — убрать
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('vz_hash','vz_pub','vz_priv','vz_slug_check') loop
    execute format('drop function %s', f.sig);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'vz\_%' and p.prosecdef loop
    execute format('drop function %s', f.sig);
  end loop;
end $$;
create or replace function public.vz_me(p_key text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_me(p_key) $$;
create or replace function public.vz_slug_free(p_slug text, p_key text default null) returns text
language sql security invoker set search_path = '' as $$ select vz_private.vz_slug_free(p_slug, p_key) $$;
create or replace function public.vz_save_card(p_key text, p_data jsonb, p_slug text default null, p_veh text default '', p_published boolean default true, p_ref text default null) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_save_card(p_key, p_data, p_slug, p_veh, p_published, p_ref) $$;
create or replace function public.vz_pay_request(p_key text, p_months int default 1) returns boolean
language sql security invoker set search_path = '' as $$ select vz_private.vz_pay_request(p_key, p_months) $$;
create or replace function public.vz_admin_lists(p_admin text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_lists(p_admin) $$;
create or replace function public.vz_admin_issue_key(p_admin text, p_card uuid) returns text
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_issue_key(p_admin, p_card) $$;
create or replace function public.vz_admin_dismiss(p_admin text, p_req bigint) returns void
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_dismiss(p_admin, p_req) $$;
create or replace function public.vz_og_list(p_token text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_og_list(p_token) $$;
create or replace function public.vz_delete_card(p_key text) returns boolean
language sql security invoker set search_path = '' as $$ select vz_private.vz_delete_card(p_key) $$;
create or replace function public.vz_my_stats(p_key text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_my_stats(p_key) $$;
create or replace function public.vz_card(p_slug text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_card(p_slug) $$;
create or replace function public.vz_catalog(p_city text default '', p_veh text default '', p_service int default null, p_limit int default 60, p_offset int default 0) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_catalog(p_city, p_veh, p_service, p_limit, p_offset) $$;
create or replace function public.vz_catalog_cities() returns text[]
language sql security invoker set search_path = '' as $$ select vz_private.vz_catalog_cities() $$;
create or replace function public.vz_track(p_slug text, p_kind text, p_device text) returns void
language sql security invoker set search_path = '' as $$ select vz_private.vz_track(p_slug, p_kind, p_device) $$;
create or replace function public.vz_is_admin(p_admin text) returns boolean
language sql security invoker set search_path = '' as $$ select vz_private.vz_is_admin(p_admin) $$;
create or replace function public.vz_admin_find(p_admin text, p_q text default '') returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_find(p_admin, p_q) $$;
create or replace function public.vz_admin_extend(p_admin text, p_card uuid, p_months int, p_note text default '') returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_extend(p_admin, p_card, p_months, p_note) $$;
create or replace function public.vz_admin_block(p_admin text, p_card uuid, p_blocked boolean) returns void
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_block(p_admin, p_card, p_blocked) $$;
create or replace function public.vz_admin_delete(p_admin text, p_card uuid) returns void
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_delete(p_admin, p_card) $$;
create or replace function public.vz_admin_log(p_admin text, p_card uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_log(p_admin, p_card) $$;
create or replace function public.vz_admin_stats(p_admin text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_stats(p_admin) $$;

-- права: всё закрыть, потом открыть только API
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'vz_private') and p.proname like 'vz\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
grant execute on function public.vz_ping() to anon, authenticated;
grant execute on function public.vz_me(text), vz_private.vz_me(text) to anon, authenticated;
grant execute on function public.vz_slug_free(text, text), vz_private.vz_slug_free(text, text) to anon, authenticated;
grant execute on function public.vz_save_card(text, jsonb, text, text, boolean, text), vz_private.vz_save_card(text, jsonb, text, text, boolean, text) to anon, authenticated;
grant execute on function public.vz_pay_request(text, int), vz_private.vz_pay_request(text, int) to anon, authenticated;
grant execute on function public.vz_admin_lists(text), vz_private.vz_admin_lists(text) to anon, authenticated;
grant execute on function public.vz_admin_dismiss(text, bigint), vz_private.vz_admin_dismiss(text, bigint) to anon, authenticated;
grant execute on function public.vz_admin_issue_key(text, uuid), vz_private.vz_admin_issue_key(text, uuid) to anon, authenticated;
grant execute on function public.vz_og_list(text), vz_private.vz_og_list(text) to anon, authenticated;
grant execute on function public.vz_delete_card(text), vz_private.vz_delete_card(text) to anon, authenticated;
grant execute on function public.vz_my_stats(text), vz_private.vz_my_stats(text) to anon, authenticated;
grant execute on function public.vz_card(text), vz_private.vz_card(text) to anon, authenticated;
grant execute on function public.vz_catalog(text, text, int, int, int), vz_private.vz_catalog(text, text, int, int, int) to anon, authenticated;
grant execute on function public.vz_catalog_cities(), vz_private.vz_catalog_cities() to anon, authenticated;
grant execute on function public.vz_track(text, text, text), vz_private.vz_track(text, text, text) to anon, authenticated;
grant execute on function public.vz_is_admin(text), vz_private.vz_is_admin(text) to anon, authenticated;
grant execute on function public.vz_admin_find(text, text), vz_private.vz_admin_find(text, text) to anon, authenticated;
grant execute on function public.vz_admin_extend(text, uuid, int, text), vz_private.vz_admin_extend(text, uuid, int, text) to anon, authenticated;
grant execute on function public.vz_admin_block(text, uuid, boolean), vz_private.vz_admin_block(text, uuid, boolean) to anon, authenticated;
grant execute on function public.vz_admin_delete(text, uuid), vz_private.vz_admin_delete(text, uuid) to anon, authenticated;
grant execute on function public.vz_admin_log(text, uuid), vz_private.vz_admin_log(text, uuid) to anon, authenticated;
grant execute on function public.vz_admin_stats(text), vz_private.vz_admin_stats(text) to anon, authenticated;

-- ---------- фото: Storage bucket vz_photos ----------
-- Публичное чтение по прямой ссылке. Загружает только edge-функция vz-photo (проверяет ключ
-- доступа и активный Про), поэтому политик на запись для клиентов нет.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vz_photos', 'vz_photos', true, 262144, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- админ (заполнить вручную) ----------
-- Ключ админа — случайная строка 43 символа (A-Z a-z 0-9 _ -). В базе хранится только её SHA-256:
-- insert into public.vz_admins (key_hash, note) values (vz_private.vz_hash('<ключ>'), 'владелец') on conflict do nothing;
-- Токен для GitHub Actions (страницы-превью): секрет репозитория VZ_OG_TOKEN, в базе — его SHA-256:
-- insert into public.vz_settings (key, value) values ('og_token_hash', vz_private.vz_hash('<токен>')) on conflict (key) do update set value = excluded.value;
