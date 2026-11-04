-- =====================================================================
--  Conceito Pet Store — banco de reservas (Supabase / Postgres)
--  Cole tudo no Supabase: SQL Editor > New query > Run.
--  Pode rodar de novo sem problema (é idempotente).
-- =====================================================================

-- 1) Configurações (uma linha só) ------------------------------------
create table if not exists public.settings (
  id           int primary key default 1 check (id = 1),
  slots        text[]  not null default array['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00'],
  capacity     int     not null default 2 check (capacity between 1 and 20),  -- pets por horário
  closed_dow   int[]   not null default array[0],                              -- 0 = domingo
  days_ahead   int     not null default 21 check (days_ahead between 1 and 90),
  updated_at   timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- 2) Administradores (quem entra no painel) ---------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 3) Reservas ---------------------------------------------------------
create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at  timestamptz not null default now(),
  day         date not null,
  slot        text not null,
  service     text not null,
  pet_name    text not null,
  pet_size    text not null,
  breed       text,
  owner_name  text not null,
  phone       text not null,
  pickup      boolean not null default false,
  address     text,
  notes       text,
  status      text not null default 'pendente'
              check (status in ('pendente','confirmado','concluido','cancelado'))
);
create index if not exists bookings_day_slot on public.bookings (day, slot);

-- 4) Bloqueios (feriado, folga, horário fechado) -----------------------
create table if not exists public.blocks (
  id     uuid primary key default gen_random_uuid(),
  day    date not null,
  slot   text,              -- vazio = dia inteiro
  reason text,
  unique (day, slot)
);

-- 5) Segurança: o público NUNCA lê nomes nem telefones -----------------
alter table public.settings enable row level security;
alter table public.admins   enable row level security;
alter table public.bookings enable row level security;
alter table public.blocks   enable row level security;

drop policy if exists settings_read  on public.settings;
drop policy if exists settings_admin on public.settings;
create policy settings_read  on public.settings for select using (true);
create policy settings_admin on public.settings for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (user_id = auth.uid());

drop policy if exists bookings_admin on public.bookings;
create policy bookings_admin on public.bookings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists blocks_admin on public.blocks;
create policy blocks_admin on public.blocks for all using (public.is_admin()) with check (public.is_admin());

-- 6) O que o site público pode ver: só "livre / lotado / bloqueado" ----
create or replace function public.availability(d_from date, d_to date)
returns table (day date, slot text, taken int, capacity int, blocked boolean)
language sql stable security definer set search_path = public as $$
  with s as (select * from public.settings where id = 1),
  days as (select generate_series(d_from, least(d_to, d_from + 90), interval '1 day')::date as day),
  grid as (select d.day, unnest(s.slots) as slot, s.capacity from days d, s)
  select g.day, g.slot,
         (select count(*)::int from public.bookings b
            where b.day = g.day and b.slot = g.slot and b.status <> 'cancelado') as taken,
         g.capacity,
         exists (select 1 from public.blocks k
                   where k.day = g.day and (k.slot is null or k.slot = g.slot)) as blocked
  from grid g
  order by g.day, g.slot;
$$;

-- 7) Fazer uma reserva (único caminho de escrita do público) -----------
create or replace function public.book(
  p_day date, p_slot text, p_service text, p_pet_name text, p_pet_size text,
  p_breed text, p_owner_name text, p_phone text, p_pickup boolean,
  p_address text, p_notes text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
  n int;
  digits text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  new_code text;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into s from public.settings where id = 1;

  if p_day is null or p_day < today or p_day > today + s.days_ahead then
    raise exception 'data_invalida';
  end if;
  if extract(dow from p_day)::int = any (s.closed_dow) then
    raise exception 'dia_fechado';
  end if;
  if not (p_slot = any (s.slots)) then
    raise exception 'horario_invalido';
  end if;
  if p_day = today and p_slot <= to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI') then
    raise exception 'horario_passou';
  end if;
  if length(digits) < 10 or length(digits) > 13 then
    raise exception 'telefone_invalido';
  end if;
  if length(trim(coalesce(p_pet_name,''))) = 0 or length(trim(coalesce(p_owner_name,''))) = 0 then
    raise exception 'dados_faltando';
  end if;
  if p_pickup and length(trim(coalesce(p_address,''))) < 6 then
    raise exception 'endereco_faltando';
  end if;

  -- trava este horário enquanto conta (evita duas reservas na mesma vaga)
  perform pg_advisory_xact_lock(hashtext(p_day::text || p_slot));

  if exists (select 1 from public.blocks k where k.day = p_day and (k.slot is null or k.slot = p_slot)) then
    raise exception 'horario_bloqueado';
  end if;

  select count(*) into n from public.bookings
   where day = p_day and slot = p_slot and status <> 'cancelado';
  if n >= s.capacity then
    raise exception 'horario_lotado';
  end if;

  -- anti-abuso: no máximo 3 reservas ativas por telefone no mesmo dia
  select count(*) into n from public.bookings
   where day = p_day and regexp_replace(phone, '\D', '', 'g') = digits and status <> 'cancelado';
  if n >= 3 then
    raise exception 'limite_telefone';
  end if;

  insert into public.bookings (day, slot, service, pet_name, pet_size, breed, owner_name, phone, pickup, address, notes)
  values (p_day, p_slot, left(p_service,60), left(trim(p_pet_name),60), left(p_pet_size,30), left(trim(p_breed),60),
          left(trim(p_owner_name),80), digits, coalesce(p_pickup,false), left(trim(p_address),200), left(trim(p_notes),400))
  returning code into new_code;

  return new_code;
end;
$$;

-- 8) Permissões --------------------------------------------------------
revoke all on public.bookings, public.blocks, public.admins from anon;
grant select on public.settings to anon, authenticated;
grant select, insert, update, delete on public.bookings, public.blocks to authenticated;
grant update on public.settings to authenticated;
grant select on public.admins to authenticated;
grant execute on function public.availability(date, date) to anon, authenticated;
grant execute on function public.book(date, text, text, text, text, text, text, text, boolean, text, text) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- 9) Depois de criar o seu usuário em Authentication > Users, rode
--    (trocando o e-mail) para virar administrador do painel:
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'seu-email@exemplo.com'
--   on conflict do nothing;
