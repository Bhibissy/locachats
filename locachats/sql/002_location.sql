-- =====================================================================
-- LOCACHAT : AJOUT 002 — infos facultatives pour les annonces en LOCATION
-- À coller dans Supabase > SQL Editor > New query, puis Run.
-- Tu peux le lancer plusieurs fois sans risque. Tes annonces ne sont pas touchées.
-- =====================================================================

-- Nouvelles colonnes (toutes facultatives) dans la table des annonces
alter table public.listings
  add column if not exists rent_unit      text    check (rent_unit in ('heure', 'jour', 'semaine', 'mois')), -- le prix est par heure, jour...
  add column if not exists available_from date,                                                               -- disponible à partir du
  add column if not exists available_to   date,                                                               -- jusqu'au
  add column if not exists hours          text    check (char_length(hours) <= 40),                           -- ex. "8h à 18h"
  add column if not exists min_duration   text    check (char_length(min_duration) <= 40),                    -- ex. "1 jour"
  add column if not exists deposit        bigint  check (deposit >= 0 and deposit <= 1000000000),             -- caution en FCFA
  add column if not exists delivery       boolean not null default false;                                     -- livraison possible

-- La date de fin ne peut pas être avant la date de début
alter table public.listings drop constraint if exists listings_dates_ok;
alter table public.listings add constraint listings_dates_ok
  check (available_to is null or available_from is null or available_to >= available_from);

-- Le propriétaire peut modifier ces colonnes (les droits sont donnés colonne par colonne)
grant update (rent_unit, available_from, available_to, hours, min_duration, deposit, delivery)
  on public.listings to authenticated;