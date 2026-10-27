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

-- v7: статус «Свободен / Занят»
alter table public.vz_cards add column if not exists status text check (status in ('free', 'busy'));
alter table public.vz_cards add column if not exists status_at timestamptz;
alter table public.vz_cards add column if not exists busy_until timestamptz;

-- v7: отзывы клиентов. По приглашению водителя — публикуются сразу; открытые — после модерации.
create table if not exists public.vz_reviews (
  id         bigserial primary key,
  card_id    uuid not null references public.vz_cards(id) on delete cascade,
  stars      int not null check (stars between 1 and 5),
  body       text not null default '' check (char_length(body) <= 500),
  author     text not null default '' check (char_length(author) <= 30),
  via_invite boolean not null default false,
  status     text not null default 'pending' check (status in ('pub', 'pending', 'hidden')),
  flag       text not null default '',           -- почему отправлен на модерацию (фильтр, жалобы)
  reply      text check (char_length(reply) <= 500),
  reply_at   timestamptz,
  device     text not null default '',
  ip_hash    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists vz_reviews_card on public.vz_reviews (card_id, status, created_at desc);
create index if not exists vz_reviews_moder on public.vz_reviews (status, created_at desc);
create table if not exists public.vz_review_invites (
  token_hash text primary key,
  card_id    uuid not null references public.vz_cards(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at    timestamptz,
  review_id  bigint references public.vz_reviews(id) on delete set null
);
create index if not exists vz_review_invites_card on public.vz_review_invites (card_id, created_at desc);
create index if not exists vz_review_invites_review on public.vz_review_invites (review_id);
create table if not exists public.vz_review_complaints (
  id         bigserial primary key,
  review_id  bigint not null references public.vz_reviews(id) on delete cascade,
  reason     text not null default '' check (char_length(reason) <= 300),
  device     text not null default '',
  handled    boolean not null default false,
  created_at timestamptz not null default now(),
  unique (review_id, device)
);
create index if not exists vz_review_complaints_open on public.vz_review_complaints (review_id) where not handled;
alter table public.vz_reviews           enable row level security;
alter table public.vz_review_invites    enable row level security;
alter table public.vz_review_complaints enable row level security;
revoke all on public.vz_reviews, public.vz_review_invites, public.vz_review_complaints from anon, authenticated;
revoke all on sequence public.vz_reviews_id_seq, public.vz_review_complaints_id_seq from anon, authenticated;

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

-- Отзывы включены? Флаг в vz_settings: reviews_enabled = 'true'. Нет записи — выключены (данные в базе сохраняются).
-- Включить: insert into public.vz_settings values ('reviews_enabled', 'true') on conflict (key) do update set value = 'true';
create or replace function vz_private.vz_reviews_on() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true' from public.vz_settings where key = 'reviews_enabled'), false);
$$;

-- Статус: показываем, только если водитель обновлял его за последние 24 часа. «Занят до» по истечении — снова «Свободен».
create or replace function vz_private.vz_status(c public.vz_cards) returns jsonb
language sql stable set search_path = '' as $$
  select case
    when c.status is null or greatest(c.status_at, c.busy_until) < now() - interval '24 hours' then null
    when c.status = 'busy' and (c.busy_until is null or c.busy_until > now()) then jsonb_build_object('s', 'busy', 'until', c.busy_until, 'at', c.status_at)
    else jsonb_build_object('s', 'free', 'at', greatest(c.status_at, c.busy_until)) end;
$$;

create or replace function vz_private.vz_pub(c public.vz_cards) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('slug', c.slug, 'd', c.data, 'photo', c.photo_path,
    'pro', coalesce(c.pro_until > now(), false), 'paid', c.is_paid, 'updated_at', c.updated_at,
    'lifetime', coalesce(c.pro_until > now() + interval '50 years', false),
    'status', vz_private.vz_status(c),
    'rating', (select jsonb_build_object('avg', round(avg(r.stars)::numeric, 1), 'n', count(*)) from public.vz_reviews r
               where r.card_id = c.id and r.status = 'pub' and vz_private.vz_reviews_on() having count(*) > 0));
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
  foreach k in array array['n','p','c','w','t','s','m','pr','pu','hs','he','tg','z','f','th','i','rt'] loop
    if p_data ? k then d := d || jsonb_build_object(k, p_data->k); end if;
  end loop;
  if length(trim(coalesce(d->>'n', ''))) not between 1 and 40 then raise exception 'Укажите имя (до 40 символов)'; end if;
  if coalesce(d->>'p', '') !~ '^7[0-9]{10}$' then raise exception 'Телефон в формате +7 7XX XXX XX XX'; end if;
  if d ? 'i' and coalesce(d->>'i', '') !~ '^https://' then d := d - 'i'; end if;
  if d ? 'rt' and coalesce(d->>'rt', '') !~ '^[0-9]{0,6}(,[0-9]{0,6}){5}$' then d := d - 'rt'; end if;
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

drop function if exists public.vz_catalog(text, text, int, int, int);
drop function if exists vz_private.vz_catalog(text, text, int, int, int);
-- Свободные водители — первыми; p_free — только свободные.
create or replace function vz_private.vz_catalog(p_city text default '', p_veh text default '', p_service int default null,
  p_limit int default 60, p_offset int default 0, p_free boolean default false) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.free desc, x.is_paid desc, x.updated_at desc), '[]'::jsonb) from (
    select vz_private.vz_pub(c) as j, c.is_paid, c.updated_at,
      coalesce(vz_private.vz_status(c)->>'s' = 'free', false) as free from public.vz_cards c
    where c.is_published and not c.is_blocked and c.slug is not null and c.pro_until > now()
      and (coalesce(p_city, '') = '' or lower(c.city) like '%' || lower(trim(p_city)) || '%')
      and (coalesce(p_veh, '') = '' or c.veh = p_veh)
      and (p_service is null or position(p_service::text in coalesce(c.data->>'s', '')) > 0)
      and (not coalesce(p_free, false) or coalesce(vz_private.vz_status(c)->>'s' = 'free', false))
    order by 4 desc, c.is_paid desc, c.updated_at desc
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

-- ---------- v7: статус ----------
-- p_minutes: на сколько «Занят» (null — пока не переключу, но не дольше 24 часов показа).
create or replace function vz_private.vz_set_status(p_key text, p_status text, p_minutes int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.vz_cards;
begin
  if p_status not in ('free', 'busy') then raise exception 'Статус: free или busy'; end if;
  update public.vz_cards set status = p_status, status_at = now(),
    busy_until = case when p_status = 'busy' and p_minutes between 1 and 1440 then now() + make_interval(mins => p_minutes) end
  where key_hash = vz_private.vz_hash(p_key) returning * into c;
  if c.id is null then raise exception 'Сначала сохраните визитку в облаке'; end if;
  return vz_private.vz_status(c);
end $$;

-- ---------- v7: отзывы ----------
-- Простая проверка текста: мат, телефоны, ссылки → на модерацию.
create or replace function vz_private.vz_review_flag(t text) returns text
language sql immutable set search_path = '' as $$
  select case
    when t ~* '(https?://|www\.|t\.me/|\m[a-z0-9-]+\.(kz|ru|com|net|org|me)\M|@[a-z0-9_]{3,})' then 'ссылка'
    when regexp_replace(t, '[^0-9]', '', 'g') ~ '[0-9]{7,}' or t ~ '[0-9][0-9 ()+-]{8,}[0-9]' then 'телефон'
    when lower(t) ~ '(хуй|хуе|хуё|пизд|ебат|ебан|ёбан|ебал|бляд|блят|сука|суки|мудак|мудил|пидор|пидар|гандон|залуп|шлюх|долбо[её]б)' then 'мат'
    else '' end;
$$;

create or replace function vz_private.vz_review_pub(r public.vz_reviews) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'stars', r.stars, 'body', r.body, 'author', r.author, 'invite', r.via_invite,
    'at', r.created_at, 'reply', r.reply, 'reply_at', r.reply_at);
$$;

-- Отзывы визитки (только опубликованные). Телефоны клиентов не хранятся и не показываются.
create or replace function vz_private.vz_reviews(p_slug text, p_limit int default 3, p_offset int default 0) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(vz_private.vz_review_pub(x) order by x.created_at desc), '[]'::jsonb) from (
    select r.* from public.vz_reviews r join public.vz_cards c on c.id = r.card_id
    where c.slug = lower(trim(p_slug)) and not c.is_blocked and r.status = 'pub' and vz_private.vz_reviews_on()
    order by r.created_at desc limit least(greatest(coalesce(p_limit, 3), 1), 50) offset greatest(coalesce(p_offset, 0), 0)) x;
$$;

-- Водитель: ссылка-приглашение для отзыва (одноразовая, 14 дней).
create or replace function vz_private.vz_review_invite(p_key text) returns text
language plpgsql security definer set search_path = '' as $$
declare cid uuid; t text := replace(gen_random_uuid()::text, '-', '');
begin
  if not vz_private.vz_reviews_on() then raise exception 'Отзывы временно отключены'; end if;
  select id into cid from public.vz_cards where key_hash = vz_private.vz_hash(p_key) and not is_blocked;
  if cid is null then raise exception 'Сначала сохраните визитку в облаке'; end if;
  if (select count(*) from public.vz_review_invites where card_id = cid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Слишком много приглашений за сутки';
  end if;
  insert into public.vz_review_invites (token_hash, card_id) values (vz_private.vz_hash(t || t), cid);
  return t;
end $$;

create or replace function vz_private.vz_review_invite_info(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('slug', c.slug, 'n', c.data->>'n', 'valid', i.used_at is null and i.expires_at > now(), 'used', i.used_at is not null)
  from public.vz_review_invites i join public.vz_cards c on c.id = i.card_id
  where i.token_hash = vz_private.vz_hash(coalesce(p_token, '') || coalesce(p_token, '')) and not c.is_blocked and vz_private.vz_reviews_on();
$$;

-- Отправить отзыв. С токеном приглашения — публикуется сразу (если текст чистый). Без — на модерацию, с лимитами.
create or replace function vz_private.vz_review_submit(p_slug text, p_stars int, p_body text, p_author text,
  p_device text default '', p_token text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.vz_cards; inv public.vz_review_invites; b text := left(btrim(coalesce(p_body, '')), 500);
  a text := left(btrim(split_part(regexp_replace(coalesce(p_author, ''), '[^[:alpha:] -]', '', 'g'), ' ', 1)), 30);
  dev text := left(coalesce(p_device, ''), 40); ip text; fl text; st text; rid bigint;
begin
  if not vz_private.vz_reviews_on() then raise exception 'Отзывы временно отключены'; end if;
  if p_stars is null or p_stars not between 1 and 5 then raise exception 'Поставьте оценку от 1 до 5'; end if;
  ip := btrim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ''), ',', 1));
  if ip <> '' then ip := encode(sha256(convert_to(ip, 'UTF8')), 'hex'); end if;
  fl := vz_private.vz_review_flag(b || ' ' || a);
  if p_token is not null and p_token <> '' then
    select * into inv from public.vz_review_invites where token_hash = vz_private.vz_hash(p_token || p_token) for update;
    if inv.token_hash is null then raise exception 'Ссылка для отзыва недействительна'; end if;
    if inv.used_at is not null then raise exception 'По этой ссылке отзыв уже оставлен'; end if;
    if inv.expires_at < now() then raise exception 'Срок ссылки для отзыва истёк'; end if;
    select * into c from public.vz_cards where id = inv.card_id and not is_blocked;
    if c.id is null then raise exception 'Визитка не найдена'; end if;
    st := case when fl = '' then 'pub' else 'pending' end;
    insert into public.vz_reviews (card_id, stars, body, author, via_invite, status, flag, device, ip_hash)
    values (c.id, p_stars, b, a, true, st, fl, dev, ip) returning id into rid;
    update public.vz_review_invites set used_at = now(), review_id = rid where token_hash = inv.token_hash;
    return st;
  end if;
  select * into c from public.vz_cards where slug = lower(trim(coalesce(p_slug, ''))) and not is_blocked;
  if c.id is null then raise exception 'Визитка не найдена'; end if;
  if length(dev) < 8 then raise exception 'Не удалось отправить отзыв'; end if;
  if exists (select 1 from public.vz_reviews where card_id = c.id and device = dev and created_at > now() - interval '30 days') then
    raise exception 'Вы уже оставляли отзыв этому водителю';
  end if;
  if (select count(*) from public.vz_reviews where (device = dev or (ip <> '' and ip_hash = ip)) and not via_invite and created_at > now() - interval '1 day') >= 5
     or (select count(*) from public.vz_reviews where not via_invite and created_at > now() - interval '1 day') >= 300 then
    raise exception 'Слишком много отзывов, попробуйте завтра';
  end if;
  insert into public.vz_reviews (card_id, stars, body, author, via_invite, status, flag, device, ip_hash)
  values (c.id, p_stars, b, a, false, 'pending', fl, dev, ip);
  return 'pending';
end $$;

-- Жалоба на отзыв. 3 жалобы — отзыв скрывается до решения админа.
create or replace function vz_private.vz_review_complain(p_id bigint, p_reason text, p_device text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not vz_private.vz_reviews_on() then raise exception 'Отзывы временно отключены'; end if;
  if length(coalesce(p_device, '')) < 8 then raise exception 'Не удалось отправить жалобу'; end if;
  if not exists (select 1 from public.vz_reviews where id = p_id and status = 'pub') then raise exception 'Отзыв не найден'; end if;
  insert into public.vz_review_complaints (review_id, reason, device) values (p_id, left(btrim(coalesce(p_reason, '')), 300), left(p_device, 40))
  on conflict (review_id, device) do nothing;
  if (select count(*) from public.vz_review_complaints where review_id = p_id and not handled) >= 3 then
    update public.vz_reviews set status = 'pending', flag = 'жалобы' where id = p_id and status = 'pub';
  end if;
  return true;
end $$;

-- Водитель: свои отзывы (опубликованные + сколько ждут модерации) и один ответ на отзыв.
create or replace function vz_private.vz_my_reviews(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with c as (select id from public.vz_cards where key_hash = vz_private.vz_hash(p_key) and vz_private.vz_reviews_on())
  select case when not exists (select 1 from c) then null else jsonb_build_object(
    'list', (select coalesce(jsonb_agg(vz_private.vz_review_pub(r) order by r.created_at desc), '[]'::jsonb) from public.vz_reviews r where r.card_id in (select id from c) and r.status = 'pub'),
    'pending', (select count(*) from public.vz_reviews r where r.card_id in (select id from c) and r.status = 'pending'),
    'invites', (select count(*) from public.vz_review_invites i where i.card_id in (select id from c) and i.used_at is null and i.expires_at > now())) end;
$$;

create or replace function vz_private.vz_review_reply(p_key text, p_id bigint, p_text text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t text := left(btrim(coalesce(p_text, '')), 500);
begin
  if not vz_private.vz_reviews_on() then raise exception 'Отзывы временно отключены'; end if;
  if t = '' then raise exception 'Напишите ответ'; end if;
  if vz_private.vz_review_flag(t) <> '' then raise exception 'В ответе нельзя: ссылки, телефоны, мат'; end if;
  update public.vz_reviews r set reply = t, reply_at = now()
  where r.id = p_id and r.reply is null and r.card_id = (select id from public.vz_cards where key_hash = vz_private.vz_hash(p_key));
  if not found then raise exception 'Ответ уже есть или отзыв не найден'; end if;
  return true;
end $$;

-- Админ: модерация отзывов и жалобы.
create or replace function vz_private.vz_admin_reviews(p_admin text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(j order by o, at desc), '[]'::jsonb) from (
    select vz_private.vz_review_pub(r) || jsonb_build_object('status', r.status, 'flag', r.flag, 'slug', c.slug, 'n', c.data->>'n',
      'complaints', (select coalesce(jsonb_agg(jsonb_build_object('reason', x.reason, 'at', x.created_at) order by x.created_at), '[]'::jsonb)
                     from public.vz_review_complaints x where x.review_id = r.id and not x.handled)) j,
      case when r.status = 'pending' then 0 else 1 end o, r.created_at at
    from public.vz_reviews r join public.vz_cards c on c.id = r.card_id
    where r.status = 'pending' or exists (select 1 from public.vz_review_complaints x where x.review_id = r.id and not x.handled)
       or (r.status = 'hidden' and r.created_at > now() - interval '60 days')
    limit 200) s);
end $$;

create or replace function vz_private.vz_admin_review_set(p_admin text, p_id bigint, p_status text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  if p_status not in ('pub', 'hidden') then raise exception 'Статус: pub или hidden'; end if;
  update public.vz_reviews set status = p_status where id = p_id;
  update public.vz_review_complaints set handled = true where review_id = p_id;
  return found;
end $$;


-- ---------- v8: лента заказов ----------
-- Клиент без аккаунта: устройство = случайный токен в localStorage, в базе только его хэш.
create table if not exists public.vz_devices (
  dev_hash   text primary key,
  blocked    boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.vz_orders (
  id         uuid primary key default gen_random_uuid(),
  dev_hash   text not null,
  what       text not null default '' check (char_length(what) <= 120),
  from_addr  text not null default '' check (char_length(from_addr) <= 120),
  to_addr    text not null default '' check (char_length(to_addr) <= 120),
  when_text  text not null default '' check (char_length(when_text) <= 40),
  when_at    timestamptz,
  calc       jsonb not null default '{}',          -- km, inter, loaders, floors, lo, hi, a{lat,lon}, b{lat,lon}
  note       text not null default '' check (char_length(note) <= 300),
  name       text not null default '' check (char_length(name) <= 30),
  phone      text not null check (phone ~ '^7[0-9]{10}$'),
  scope      text not null default 'all' check (scope in ('all', 'picked')),
  status     text not null default 'open' check (status in ('open', 'taken', 'cancelled', 'hidden')),
  taken_card uuid references public.vz_cards(id) on delete set null,
  review_issued boolean not null default false,
  ip_hash    text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists vz_orders_dev on public.vz_orders (dev_hash, created_at desc);
create index if not exists vz_orders_open on public.vz_orders (status, expires_at) where status = 'open';
create index if not exists vz_orders_taken on public.vz_orders (taken_card);
create table if not exists public.vz_order_targets (
  order_id uuid not null references public.vz_orders(id) on delete cascade,
  card_id  uuid not null references public.vz_cards(id) on delete cascade,
  primary key (order_id, card_id)
);
create index if not exists vz_order_targets_card on public.vz_order_targets (card_id);
create table if not exists public.vz_order_responses (
  order_id   uuid not null references public.vz_orders(id) on delete cascade,
  card_id    uuid not null references public.vz_cards(id) on delete cascade,
  price      int check (price between 0 and 10000000),
  comment    text not null default '' check (char_length(comment) <= 200),
  created_at timestamptz not null default now(),
  primary key (order_id, card_id)
);
create index if not exists vz_order_responses_card on public.vz_order_responses (card_id);
alter table public.vz_devices         enable row level security;
alter table public.vz_orders          enable row level security;
alter table public.vz_order_targets   enable row level security;
alter table public.vz_order_responses enable row level security;
revoke all on public.vz_devices, public.vz_orders, public.vz_order_targets, public.vz_order_responses from anon, authenticated;

create or replace function vz_private.vz_ip() returns text
language sql stable set search_path = '' as $$
  select coalesce(nullif(encode(sha256(convert_to(nullif(btrim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ''), ',', 1)), ''), 'UTF8')), 'hex'), ''), '');
$$;

-- Заказ для водителя: без телефона клиента, пока водитель не откликнулся.
create or replace function vz_private.vz_order_pub(o public.vz_orders, show_phone boolean) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'what', o.what, 'from', o.from_addr, 'to', o.to_addr, 'when', o.when_text, 'when_at', o.when_at,
    'calc', o.calc, 'note', o.note, 'name', o.name, 'scope', o.scope, 'status', o.status, 'at', o.created_at, 'expires_at', o.expires_at,
    'phone', case when show_phone then o.phone end);
$$;

create or replace function vz_private.vz_order_create(p_dev text, p_order jsonb, p_slugs text[] default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare h text := vz_private.vz_hash(p_dev); ip text := vz_private.vz_ip(); o jsonb := coalesce(p_order, '{}'); oid uuid;
  ph text := regexp_replace(coalesce(o->>'phone', ''), '[^0-9]', '', 'g'); wat timestamptz; c jsonb := '{}'; n int;
begin
  if h is null then raise exception 'Не удалось отправить заказ'; end if;
  if exists (select 1 from public.vz_devices where dev_hash = h and blocked) then raise exception 'Заказы с этого устройства отключены. Напишите в поддержку ВЕЗУ'; end if;
  if length(ph) = 11 and ph ~ '^8' then ph := '7' || substr(ph, 2); end if;
  if length(ph) = 10 then ph := '7' || ph; end if;
  if ph !~ '^7[0-9]{10}$' then raise exception 'Укажите телефон для связи'; end if;
  if btrim(coalesce(o->>'what', '') || coalesce(o->>'from', '') || coalesce(o->>'to', '')) = '' then raise exception 'Напишите, что везём и откуда'; end if;
  if vz_private.vz_review_flag(concat_ws(' ', o->>'what', o->>'from', o->>'to', o->>'note', o->>'name', o->>'when')) in ('ссылка', 'мат') then
    raise exception 'Уберите из заказа ссылки и нецензурные слова';
  end if;
  if (select count(*) from public.vz_orders where (dev_hash = h or (ip <> '' and ip_hash = ip)) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Не больше 5 заказов в час. Попробуйте позже';
  end if;
  insert into public.vz_devices (dev_hash) values (h) on conflict do nothing;
  begin wat := nullif(o->>'when_at', '')::timestamptz; exception when others then wat := null; end;
  if wat is not null and (wat < now() - interval '1 hour' or wat > now() + interval '14 days') then wat := null; end if;
  if jsonb_typeof(o->'calc') = 'object' then
    select coalesce(jsonb_object_agg(k, v), '{}') into c from jsonb_each(o->'calc') e(k, v)
    where (k in ('km', 'inter', 'loaders', 'floors', 'lo', 'hi', 'price') and jsonb_typeof(v) = 'number')
       or (k in ('a', 'b') and jsonb_typeof(v) = 'object' and jsonb_typeof(v->'lat') = 'number' and jsonb_typeof(v->'lon') = 'number');
    c := c - 'a' - 'b' || coalesce(case when c ? 'a' then jsonb_build_object('a', jsonb_build_object('lat', c->'a'->'lat', 'lon', c->'a'->'lon')) end, '{}')
                    || coalesce(case when c ? 'b' then jsonb_build_object('b', jsonb_build_object('lat', c->'b'->'lat', 'lon', c->'b'->'lon')) end, '{}');
  end if;
  insert into public.vz_orders (dev_hash, what, from_addr, to_addr, when_text, when_at, calc, note, name, phone, scope, ip_hash, expires_at)
  values (h, left(btrim(coalesce(o->>'what', '')), 120), left(btrim(coalesce(o->>'from', '')), 120), left(btrim(coalesce(o->>'to', '')), 120),
    left(btrim(coalesce(o->>'when', '')), 40), wat, c, left(btrim(coalesce(o->>'note', '')), 300),
    left(btrim(split_part(regexp_replace(coalesce(o->>'name', ''), '[^[:alpha:] -]', '', 'g'), ' ', 1)), 30), ph,
    case when coalesce(array_length(p_slugs, 1), 0) > 0 then 'picked' else 'all' end, ip,
    case when wat is not null and wat > now() + interval '22 hours' then wat + interval '2 hours' else now() + interval '24 hours' end)
  returning id into oid;
  if coalesce(array_length(p_slugs, 1), 0) > 0 then
    insert into public.vz_order_targets (order_id, card_id)
    select oid, c2.id from public.vz_cards c2 where c2.slug = any (p_slugs[1:30]) and not c2.is_blocked on conflict do nothing;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'Выбранные водители не найдены'; end if;
  end if;
  return oid;
end $$;

-- Мои заказы (клиент): статус и отклики водителей.
create or replace function vz_private.vz_my_orders(p_dev text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(j order by at desc), '[]'::jsonb) from (
    select o.created_at at, vz_private.vz_order_pub(o, true) || jsonb_build_object(
      'state', case when o.status = 'open' and o.expires_at < now() then 'expired' else o.status end,
      'taken', (select c.slug from public.vz_cards c where c.id = o.taken_card),
      'review_issued', o.review_issued,
      'targets', (select coalesce(jsonb_agg(c.data->>'n'), '[]') from public.vz_order_targets t join public.vz_cards c on c.id = t.card_id where t.order_id = o.id),
      'responses', (select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'n', c.data->>'n', 'c', c.data->>'c', 'w', c.data->>'w', 'p', c.data->>'p',
          'photo', case when c.pro_until > now() then c.photo_path end, 'price', r.price, 'comment', r.comment, 'at', r.created_at,
          'rating', (vz_private.vz_pub(c))->'rating') order by r.created_at), '[]')
        from public.vz_order_responses r join public.vz_cards c on c.id = r.card_id where r.order_id = o.id and not c.is_blocked)) j
    from public.vz_orders o where o.dev_hash = vz_private.vz_hash(p_dev) and o.status <> 'hidden' and o.created_at > now() - interval '30 days'
    order by o.created_at desc limit 50) s;
$$;

create or replace function vz_private.vz_order_pick(p_dev text, p_id uuid, p_slug text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select r.card_id into cid from public.vz_order_responses r join public.vz_cards c on c.id = r.card_id
  where r.order_id = p_id and c.slug = lower(btrim(coalesce(p_slug, '')));
  if cid is null then raise exception 'Этот водитель не откликался'; end if;
  update public.vz_orders set status = 'taken', taken_card = cid
  where id = p_id and dev_hash = vz_private.vz_hash(p_dev) and status = 'open';
  if not found then raise exception 'Заказ уже закрыт'; end if;
  return true;
end $$;

create or replace function vz_private.vz_order_cancel(p_dev text, p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.vz_orders set status = 'cancelled' where id = p_id and dev_hash = vz_private.vz_hash(p_dev) and status in ('open', 'taken');
  if not found then raise exception 'Заказ не найден'; end if;
  return true;
end $$;

-- После выбора водителя клиент может оставить отзыв: одноразовое приглашение (один раз на заказ).
create or replace function vz_private.vz_order_review(p_dev text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.vz_orders; t text := replace(gen_random_uuid()::text, '-', '');
begin
  if not vz_private.vz_reviews_on() then raise exception 'Отзывы временно отключены'; end if;
  select * into o from public.vz_orders where id = p_id and dev_hash = vz_private.vz_hash(p_dev) for update;
  if o.id is null or o.status <> 'taken' or o.taken_card is null then raise exception 'Отзыв — после выбора водителя'; end if;
  if o.review_issued then raise exception 'Отзыв по этому заказу уже оставлен'; end if;
  insert into public.vz_review_invites (token_hash, card_id) values (vz_private.vz_hash(t || t), o.taken_card);
  update public.vz_orders set review_issued = true where id = o.id;
  return jsonb_build_object('token', t, 'slug', (select slug from public.vz_cards where id = o.taken_card));
end $$;

-- Лента водителя: открытые общие заказы + адресованные ему («Лично вам» — сверху). Телефон — только после отклика.
create or replace function vz_private.vz_feed(p_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.vz_cards;
begin
  select * into c from public.vz_cards where key_hash = vz_private.vz_hash(p_key);
  if c.id is null then raise exception 'Сначала сохраните визитку в облаке'; end if;
  if c.is_blocked then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(j order by mine desc, personal desc, at desc), '[]'::jsonb) from (
    select o.created_at at, coalesce(o.taken_card = c.id, false) mine, (t.card_id is not null) personal,
      vz_private.vz_order_pub(o, r.card_id is not null) || jsonb_build_object('personal', t.card_id is not null,
        'mine', coalesce(o.taken_card = c.id, false), 'my', case when r.card_id is not null then jsonb_build_object('price', r.price, 'comment', r.comment) end,
        'responses', (select count(*) from public.vz_order_responses x where x.order_id = o.id)) j
    from public.vz_orders o
    left join public.vz_order_targets t on t.order_id = o.id and t.card_id = c.id
    left join public.vz_order_responses r on r.order_id = o.id and r.card_id = c.id
    where o.dev_hash not in (select d.dev_hash from public.vz_devices d where d.blocked)
      and ((o.status = 'open' and o.expires_at > now() and (o.scope = 'all' or t.card_id is not null))
        or (o.status = 'taken' and o.taken_card = c.id and o.created_at > now() - interval '3 days'))
    order by o.created_at desc limit 100) s);
end $$;

create or replace function vz_private.vz_order_respond(p_key text, p_id uuid, p_price int default null, p_comment text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.vz_cards; o public.vz_orders; cm text := left(btrim(coalesce(p_comment, '')), 200);
begin
  select * into c from public.vz_cards where key_hash = vz_private.vz_hash(p_key) and not is_blocked;
  if c.id is null then raise exception 'Сначала сохраните визитку в облаке'; end if;
  select * into o from public.vz_orders where id = p_id;
  if o.id is null or o.status <> 'open' or o.expires_at < now() then raise exception 'Заказ уже закрыт'; end if;
  if o.scope = 'picked' and not exists (select 1 from public.vz_order_targets where order_id = o.id and card_id = c.id) then raise exception 'Заказ адресован другим водителям'; end if;
  if vz_private.vz_review_flag(cm) in ('ссылка', 'мат') then raise exception 'В комментарии нельзя: ссылки, мат'; end if;
  insert into public.vz_order_responses (order_id, card_id, price, comment) values (o.id, c.id, nullif(greatest(p_price, 0), 0), cm)
  on conflict (order_id, card_id) do update set price = excluded.price, comment = excluded.comment, created_at = now();
  return vz_private.vz_order_pub(o, true);
end $$;

-- Админ: заказы, скрыть, заблокировать устройство.
create or replace function vz_private.vz_admin_orders(p_admin text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(j order by at desc), '[]'::jsonb) from (
    select o.created_at at, vz_private.vz_order_pub(o, true) || jsonb_build_object('dev', left(o.dev_hash, 12),
      'blocked', coalesce((select d.blocked from public.vz_devices d where d.dev_hash = o.dev_hash), false),
      'state', case when o.status = 'open' and o.expires_at < now() then 'expired' else o.status end,
      'responses', (select count(*) from public.vz_order_responses r where r.order_id = o.id),
      'dev_orders', (select count(*) from public.vz_orders x where x.dev_hash = o.dev_hash)) j
    from public.vz_orders o where o.created_at > now() - interval '30 days' order by o.created_at desc limit 200) s);
end $$;

create or replace function vz_private.vz_admin_order_set(p_admin text, p_id uuid, p_hide boolean, p_block boolean default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare h text;
begin
  if not vz_private.vz_is_admin(p_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
  select dev_hash into h from public.vz_orders where id = p_id;
  if h is null then raise exception 'Заказ не найден'; end if;
  if p_hide is not null then update public.vz_orders set status = case when p_hide then 'hidden' else 'open' end where id = p_id and (p_hide or status = 'hidden'); end if;
  if p_block is not null then
    insert into public.vz_devices (dev_hash, blocked) values (h, p_block) on conflict (dev_hash) do update set blocked = excluded.blocked;
    if p_block then update public.vz_orders set status = 'hidden' where dev_hash = h and status = 'open'; end if;
  end if;
  return true;
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
create or replace function public.vz_order_create(p_dev text, p_order jsonb, p_slugs text[] default null) returns uuid
language sql security invoker set search_path = '' as $$ select vz_private.vz_order_create(p_dev, p_order, p_slugs) $$;
create or replace function public.vz_my_orders(p_dev text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_my_orders(p_dev) $$;
create or replace function public.vz_order_pick(p_dev text, p_id uuid, p_slug text) returns boolean
language sql security invoker set search_path = '' as $$ select vz_private.vz_order_pick(p_dev, p_id, p_slug) $$;
create or replace function public.vz_order_cancel(p_dev text, p_id uuid) returns boolean
language sql security invoker set search_path = '' as $$ select vz_private.vz_order_cancel(p_dev, p_id) $$;
create or replace function public.vz_order_review(p_dev text, p_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_order_review(p_dev, p_id) $$;
create or replace function public.vz_feed(p_key text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_feed(p_key) $$;
create or replace function public.vz_order_respond(p_key text, p_id uuid, p_price int default null, p_comment text default '') returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_order_respond(p_key, p_id, p_price, p_comment) $$;
create or replace function public.vz_admin_orders(p_admin text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_orders(p_admin) $$;
create or replace function public.vz_admin_order_set(p_admin text, p_id uuid, p_hide boolean, p_block boolean default null) returns boolean
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_order_set(p_admin, p_id, p_hide, p_block) $$;
create or replace function public.vz_set_status(p_key text, p_status text, p_minutes int default null) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_set_status(p_key, p_status, p_minutes) $$;
create or replace function public.vz_reviews(p_slug text, p_limit int default 3, p_offset int default 0) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_reviews(p_slug, p_limit, p_offset) $$;
create or replace function public.vz_review_invite(p_key text) returns text
language sql security invoker set search_path = '' as $$ select vz_private.vz_review_invite(p_key) $$;
create or replace function public.vz_review_invite_info(p_token text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_review_invite_info(p_token) $$;
create or replace function public.vz_review_submit(p_slug text, p_stars int, p_body text, p_author text, p_device text default '', p_token text default null) returns text
language sql security invoker set search_path = '' as $$ select vz_private.vz_review_submit(p_slug, p_stars, p_body, p_author, p_device, p_token) $$;
create or replace function public.vz_review_complain(p_id bigint, p_reason text, p_device text) returns boolean
language sql security invoker set search_path = '' as $$ select vz_private.vz_review_complain(p_id, p_reason, p_device) $$;
create or replace function public.vz_my_reviews(p_key text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_my_reviews(p_key) $$;
create or replace function public.vz_review_reply(p_key text, p_id bigint, p_text text) returns boolean
language sql security invoker set search_path = '' as $$ select vz_private.vz_review_reply(p_key, p_id, p_text) $$;
create or replace function public.vz_admin_reviews(p_admin text) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_reviews(p_admin) $$;
create or replace function public.vz_admin_review_set(p_admin text, p_id bigint, p_status text) returns boolean
language sql security invoker set search_path = '' as $$ select vz_private.vz_admin_review_set(p_admin, p_id, p_status) $$;
create or replace function public.vz_catalog(p_city text default '', p_veh text default '', p_service int default null, p_limit int default 60, p_offset int default 0, p_free boolean default false) returns jsonb
language sql security invoker set search_path = '' as $$ select vz_private.vz_catalog(p_city, p_veh, p_service, p_limit, p_offset, p_free) $$;
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
grant execute on function public.vz_catalog(text, text, int, int, int, boolean), vz_private.vz_catalog(text, text, int, int, int, boolean) to anon, authenticated;
grant execute on function public.vz_order_create(text, jsonb, text[]), vz_private.vz_order_create(text, jsonb, text[]) to anon, authenticated;
grant execute on function public.vz_my_orders(text), vz_private.vz_my_orders(text) to anon, authenticated;
grant execute on function public.vz_order_pick(text, uuid, text), vz_private.vz_order_pick(text, uuid, text) to anon, authenticated;
grant execute on function public.vz_order_cancel(text, uuid), vz_private.vz_order_cancel(text, uuid) to anon, authenticated;
grant execute on function public.vz_order_review(text, uuid), vz_private.vz_order_review(text, uuid) to anon, authenticated;
grant execute on function public.vz_feed(text), vz_private.vz_feed(text) to anon, authenticated;
grant execute on function public.vz_order_respond(text, uuid, int, text), vz_private.vz_order_respond(text, uuid, int, text) to anon, authenticated;
grant execute on function public.vz_admin_orders(text), vz_private.vz_admin_orders(text) to anon, authenticated;
grant execute on function public.vz_admin_order_set(text, uuid, boolean, boolean), vz_private.vz_admin_order_set(text, uuid, boolean, boolean) to anon, authenticated;
grant execute on function public.vz_set_status(text, text, int), vz_private.vz_set_status(text, text, int) to anon, authenticated;
grant execute on function public.vz_reviews(text, int, int), vz_private.vz_reviews(text, int, int) to anon, authenticated;
grant execute on function public.vz_review_invite(text), vz_private.vz_review_invite(text) to anon, authenticated;
grant execute on function public.vz_review_invite_info(text), vz_private.vz_review_invite_info(text) to anon, authenticated;
grant execute on function public.vz_review_submit(text, int, text, text, text, text), vz_private.vz_review_submit(text, int, text, text, text, text) to anon, authenticated;
grant execute on function public.vz_review_complain(bigint, text, text), vz_private.vz_review_complain(bigint, text, text) to anon, authenticated;
grant execute on function public.vz_my_reviews(text), vz_private.vz_my_reviews(text) to anon, authenticated;
grant execute on function public.vz_review_reply(text, bigint, text), vz_private.vz_review_reply(text, bigint, text) to anon, authenticated;
grant execute on function public.vz_admin_reviews(text), vz_private.vz_admin_reviews(text) to anon, authenticated;
grant execute on function public.vz_admin_review_set(text, bigint, text), vz_private.vz_admin_review_set(text, bigint, text) to anon, authenticated;
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
