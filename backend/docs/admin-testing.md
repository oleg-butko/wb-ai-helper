# Admin Testing

The app-admin workspace tools are for manual testing and development. They are disabled unless the authenticated user's email exists in `public.admins`.

## Enable App-Admin Access

Create a normal Supabase Auth user, then add the lowercased email to `public.admins` in Supabase Studio:

```sql
insert into public.admins (email)
values ('admin@example.com');
```

To disable an admin without deleting the audit trail:

```sql
update public.admins
set disabled_at = now()
where email = 'admin@example.com';
```

The lookup is server-side and requires `disabled_at is null`.

## Manual Setup

1. Create or choose a normal Supabase Auth user for manual testing.
2. Add that user's lowercased email to `public.admins`.
3. Sign in as that user.
4. Open the personal workspace page.

The personal workspace overview shows admin testing tools only for admin-table users. The first slice can inspect the first 10 workspaces, list members, change existing non-owner member roles between `admin` and `member`, and change ModuleLab access between no access, `viewer`, and `operator`.

## Safety Notes

- Do not commit real app-admin emails, passwords, service-role keys, or local `.env` files.
- Keep `public.admins` empty in environments where manual app-admin testing is not intended.
- Admin lookup is database-backed, but individual admin actions still need feature-specific audit logging when they become product-facing.
