-- =====================================================================
-- LOCACHAT : base de données V1
-- À coller en entier dans Supabase > SQL Editor, puis cliquer sur "Run".
-- =====================================================================


-- 1) PROFILS : un profil public par utilisateur (nom affiché + ville) ---
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  city text check (city is null or char_length(city) <= 40),
  created_at timestamptz not null default now()
);

-- Crée automatiquement le profil quand quelqu'un s'inscrit (email ou Google)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, city)
  values (
    new.id,
    left(trim(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Utilisateur'
    )), 60),
    left(nullif(trim(new.raw_user_meta_data ->> 'city'), ''), 40)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2) ANNONCES ---------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) between 1 and 500),
  category text not null check (category in ('tech', 'elec', 'mode', 'serv', 'loc')),
  type text not null check (type in ('vente', 'location')),
  city text not null check (char_length(city) between 1 and 40),
  price bigint not null check (price >= 0 and price <= 1000000000),
  sold boolean not null default false,
  created_at timestamptz not null default now()
);
create index listings_created_idx on public.listings (created_at desc);
create index listings_filter_idx on public.listings (category, city);
create index listings_owner_idx on public.listings (owner_id);


-- 3) PHOTOS DES ANNONCES (le fichier est dans Storage, ici on garde son chemin)
create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  path text not null unique,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index listing_photos_listing_idx on public.listing_photos (listing_id);


-- 4) CONVERSATIONS : une conversation par annonce et par acheteur -------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);
create index conversations_buyer_idx on public.conversations (buyer_id);
create index conversations_seller_idx on public.conversations (seller_id);


-- 5) MESSAGES ---------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at);

-- Met à jour la date du dernier message de la conversation
create function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();


-- 6) SIGNALEMENTS ET AVIS SUR LE SITE (le site ne peut qu'écrire dedans ;
--    toi seul les lis, dans Table Editor) --------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  subject text not null check (char_length(subject) between 1 and 50),
  rating smallint not null check (rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 600),
  created_at timestamptz not null default now()
);


-- 7) FONCTIONS UTILES -------------------------------------------------
-- Marque comme lus les messages reçus dans une conversation
create function public.mark_conversation_read(conv uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages m
     set read_at = now()
   where m.conversation_id = conv
     and m.read_at is null
     and m.sender_id <> (select auth.uid())
     and exists (
       select 1 from public.conversations c
        where c.id = conv
          and (select auth.uid()) in (c.buyer_id, c.seller_id)
     );
$$;

-- Supprime le compte de la personne connectée (et tout ce qui lui appartient)
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Non connecté';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

-- Seules les personnes connectées peuvent appeler ces fonctions
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_conversation() from public, anon, authenticated;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;


-- 8) SÉCURITÉ : RLS (Row Level Security) ------------------------------
alter table public.profiles       enable row level security;
alter table public.listings       enable row level security;
alter table public.listing_photos enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.reports        enable row level security;
alter table public.feedback       enable row level security;

-- Profils : tout le monde voit les noms, chacun modifie le sien
create policy "profiles_lecture" on public.profiles
  for select to anon, authenticated using (true);
create policy "profiles_modifier_le_mien" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Annonces : tout le monde les voit, chacun gère les siennes (30 maximum)
create policy "annonces_lecture" on public.listings
  for select to anon, authenticated using (true);
create policy "annonces_creer" on public.listings
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select count(*) from public.listings l where l.owner_id = (select auth.uid())) < 30
  );
create policy "annonces_modifier_les_miennes" on public.listings
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "annonces_supprimer_les_miennes" on public.listings
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Photos : tout le monde les voit, seul le vendeur en ajoute (4 maximum) ou en retire
create policy "photos_lecture" on public.listing_photos
  for select to anon, authenticated using (true);
create policy "photos_ajouter_aux_miennes" on public.listing_photos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.listings l
       where l.id = listing_photos.listing_id
         and l.owner_id = (select auth.uid())
    )
    and (select count(*) from public.listing_photos p where p.listing_id = listing_photos.listing_id) < 4
  );
create policy "photos_supprimer_les_miennes" on public.listing_photos
  for delete to authenticated
  using (
    exists (
      select 1 from public.listings l
       where l.id = listing_photos.listing_id
         and l.owner_id = (select auth.uid())
    )
  );

-- Conversations : seuls l'acheteur et le vendeur les voient
create policy "conversations_lecture_participants" on public.conversations
  for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));
create policy "conversations_creer_comme_acheteur" on public.conversations
  for insert to authenticated
  with check (
    buyer_id = (select auth.uid())
    and seller_id = (select l.owner_id from public.listings l where l.id = conversations.listing_id)
  );

-- Messages : seuls les deux participants lisent et écrivent
create policy "messages_lecture_participants" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and (select auth.uid()) in (c.buyer_id, c.seller_id)
    )
  );
create policy "messages_ecrire_participants" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and (select auth.uid()) in (c.buyer_id, c.seller_id)
    )
  );

-- Signalements et avis : on peut seulement écrire (aucune lecture depuis le site)
create policy "signalements_ecrire" on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "avis_ecrire" on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));


-- 9) DROITS D'ACCÈS (on retire tout, puis on donne seulement le nécessaire)
revoke all on public.profiles, public.listings, public.listing_photos,
              public.conversations, public.messages, public.reports, public.feedback
  from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.profiles, public.listings, public.listing_photos to anon, authenticated;
grant update (display_name, city) on public.profiles to authenticated;
grant insert, delete on public.listings to authenticated;
grant update (title, description, category, type, city, price, sold) on public.listings to authenticated;
grant insert, delete on public.listing_photos to authenticated;
grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant insert on public.reports, public.feedback to authenticated;


-- 10) STOCKAGE DES PHOTOS ---------------------------------------------
-- Dossier public "listing-photos" : JPEG ou WebP, 1 Mo maximum par fichier
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 1048576, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Chacun ne peut ajouter, voir (pour pouvoir supprimer) ou supprimer des fichiers que dans son propre dossier
create policy "photos_fichiers_lire_les_miens" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "photos_fichiers_ajouter" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "photos_fichiers_supprimer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- 11) MESSAGERIE EN TEMPS RÉEL ----------------------------------------
alter publication supabase_realtime add table public.messages;