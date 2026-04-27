-- Add email column to profiles for display purposes
alter table profiles add column if not exists email text;
