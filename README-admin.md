# Admin gallery dashboard

## 1) Create the Supabase storage bucket
In the Supabase dashboard:
- open Storage
- create a new bucket called `portfolio-images`
- set it to public

## 2) Run the gallery schema
Open Supabase SQL Editor and run the SQL from `supabase-gallery-schema.sql`.

## 3) Add the approved admin user account
Create a user in Supabase Auth using the exact email you want to allow. Then update the allowed-email list in both `admin.html` and `login.html` to match that address.

Example:
- `window.__ADMIN_ALLOWED_EMAILS__ = ['your-admin-email@example.com'];`

Only this email can sign in to the admin dashboard.

## 4) Login
Open `login.html` in the browser and sign in with that approved admin account.

## 5) Upload and delete images
The admin page will let you add and delete images. The main site will display only active gallery rows.

## Notes
The default gallery on the front page is a fallback if Supabase is not configured or no images are returned.
