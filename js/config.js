// ВЕЗУ — настройки облака (ВЕЗУ Про). Здесь только ПУБЛИЧНЫЕ данные:
// адрес проекта Supabase и publishable-ключ (он и должен быть в браузере, защита — в базе).
// service_role ключ сюда НЕ вставлять никогда. Если функций vz_* в базе нет —
// сайт сам работает как раньше (визитка-ссылка), а Про показывается как «скоро».
window.VEZU_CFG = {
  SUPABASE_URL: 'https://sfgrwquitlnzlkyzashb.supabase.co',
  SUPABASE_KEY: 'sb_publishable_YAwB9N3mFTTnrb4SjD4-TQ_equzK7-s',
  PRO_PRICE: 1500,       // ₸ в месяц
  TRIAL_DAYS: 7,
  // Отзывы клиентов: false — скрыты везде (код и данные сохранены). Включить: true здесь И в базе
  // insert into public.vz_settings values ('reviews_enabled', 'true') on conflict (key) do update set value = 'true';
  REVIEWS_ENABLED: false,
  FORCE_OFF: false       // true — выключить облако (всё как без Про)
};
