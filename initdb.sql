-- supprimer la base
drop database if exists dbcd;

-- supprimer le rôle
drop role if exists dbcduser;

create role dbcduser with login password 'ZmqGKrs9sTantWz';
create database dbcd owner dbcduser;

-- table des utilisateurs
create table users (
    id serial primary key,
    firstname text not null,
    lastname text not null,
    isadmin integer default 0,
    isdeleted integer default 0,
    date timestamp default current_timestamp
);

create unique index idx_users_name_active
on users(firstname, lastname)
where isdeleted = 0;

-- table des badges
create table badge (
    id serial primary key,
    rfid text not null,
    user_id integer not null references users(id),
    isdeleted integer default 0,
    date timestamp default current_timestamp
);

create unique index idx_badge_rfid_active
on badge(rfid)
where isdeleted = 0;

-- trigger pour mettre à jour les badges
create or replace function set_badge_deleted_fn()
returns trigger as $$
begin
    if new.isdeleted = 1 then
        update badge
        set isdeleted = 1
        where user_id = new.id;
    end if;
    return new;
end;
$$ language plpgsql;

create trigger set_badge_deleted
after update of isdeleted on users
for each row
execute function set_badge_deleted_fn();

-- table des logs d'accès
create table accesslogs (
    id serial primary key,
    log text not null,
    badge_id integer not null references badge(id),
    date timestamp default current_timestamp
);

grant select, insert, update, delete on all tables in schema public to dbcduser;
grant usage, select, update on all sequences in schema public to dbcduser;