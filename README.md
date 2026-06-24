# Ghazala Institute — Fee CRM

A secure, self-hosted fee tracking system: Node.js/Express + MySQL backend, React frontend,
admin login (username + bcrypt-hashed password + JWT sessions). Runs as its own app and its
own database on your existing Hostinger VPS, separate from the WhatsApp CRM, at its own
subdomain: **fees.ghazalainstitute.com**.

## What's in this folder

```
ghazala-fee-crm/
├── server/                 Express + MySQL backend (API)
│   ├── schema.sql          Run once to create the database & tables
│   ├── .env.example        Copy to .env and fill in real values
│   ├── server.js           Entry point
│   ├── routes/             auth, students, dashboard, images, export
│   ├── utils/seedAdmin.js  Creates your admin login
│   └── uploads/            Where student photos are stored on disk
├── client/                 React frontend (Vite)
│   └── src/...
└── nginx-fees.ghazalainstitute.com.conf   Sample nginx config
```

## 1. Copy this folder to your VPS

From your own computer:

```bash
scp -r ghazala-fee-crm your-vps-user@your-vps-ip:/var/www/
```

Or zip it, upload via Hostinger's file manager, and unzip on the server. Either way, end up
with the folder at `/var/www/ghazala-fee-crm` on the VPS (adjust paths below if you put it
somewhere else).

## 2. Create the MySQL database

SSH into your VPS, then:

```bash
mysql -u root -p
```

Inside the MySQL prompt:

```sql
SOURCE /var/www/ghazala-fee-crm/server/schema.sql;

CREATE USER 'ghazala_fees_user'@'localhost' IDENTIFIED BY 'choose-a-strong-password-here';
GRANT ALL PRIVILEGES ON ghazala_fees.* TO 'ghazala_fees_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

This is a **separate database** from your WhatsApp CRM's database — they don't touch each
other.

## 3. Configure and install the backend

```bash
cd /var/www/ghazala-fee-crm/server
cp .env.example .env
nano .env
```

Fill in:
- `DB_PASSWORD` — the password you just set for `ghazala_fees_user`
- `JWT_SECRET` — generate one with `openssl rand -base64 48` and paste the result
- `ALLOWED_ORIGIN` — `https://fees.ghazalainstitute.com`

Then install dependencies and create your admin login:

```bash
npm install
node utils/seedAdmin.js admin "ChooseAStrongPassword123!"
```

This prints a confirmation once your admin account is created. **Use a real strong
password** — this is the only thing standing between the public internet and your
students' financial data. Run the same command again any time to reset the password.

## 4. Run the backend with PM2

If PM2 isn't already installed (you may already have it for the WhatsApp CRM):

```bash
npm install -g pm2
```

Start the app:

```bash
cd /var/www/ghazala-fee-crm/server
pm2 start server.js --name ghazala-fee-crm
pm2 save
```

`pm2 save` plus `pm2 startup` (run once, follow its printed instructions) makes sure this
restarts automatically if the VPS reboots — same as your WhatsApp CRM.

Useful commands:
```bash
pm2 logs ghazala-fee-crm      # view live logs
pm2 restart ghazala-fee-crm   # after pulling code changes
pm2 status                    # confirm it's running, alongside your other apps
```

## 5. Build the frontend

```bash
cd /var/www/ghazala-fee-crm/client
npm install
npm run build
```

This produces `client/dist/` — a folder of static files that nginx will serve directly
(no Node process needed for the frontend itself).

If your API will be reachable at the same domain (recommended, via the nginx config
below), you don't need to set `VITE_API_URL` — it defaults to `/api`. Rebuild
(`npm run build`) any time you change frontend code.

## 6. Point the subdomain at this VPS

In your domain's DNS settings (wherever ghazalainstitute.com is managed):
- Add an **A record**: `fees` → your VPS's IP address (same IP as `crm.ghazalainstitute.com`)

DNS changes can take a few minutes to an hour to propagate.

## 7. Configure nginx

```bash
sudo cp /var/www/ghazala-fee-crm/nginx-fees.ghazalainstitute.com.conf /etc/nginx/sites-available/fees.ghazalainstitute.com
sudo ln -s /etc/nginx/sites-available/fees.ghazalainstitute.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` checks the config is valid before reloading — if it reports an error, fix that
before reloading.

## 8. Add HTTPS (required — never run this without it)

```bash
sudo certbot --nginx -d fees.ghazalainstitute.com
```

Certbot edits the nginx config automatically to add the SSL certificate and redirect HTTP
to HTTPS. If you already have certbot set up for `crm.ghazalainstitute.com`, this just adds
the new subdomain to it.

## 9. Visit it

Open `https://fees.ghazalainstitute.com`, log in with the admin username/password you
created in step 3.

---

## Security notes

- **Public access is blocked by design**: every API route except `/api/auth/login` requires
  a valid login token. There is no public signup — only the admin account(s) you create
  with `seedAdmin.js` can log in.
- Passwords are stored as bcrypt hashes, never in plain text.
- 5 failed login attempts in a row locks that username out for 15 minutes.
- Sessions expire after 12 hours by default (`JWT_EXPIRES_IN` in `.env`) — change this if
  you want admins to stay logged in longer or shorter.
- **Back up your database regularly.** A simple cron job:
  ```bash
  mysqldump -u ghazala_fees_user -p ghazala_fees > /var/backups/ghazala_fees_$(date +%F).sql
  ```
  Consider copying backups off the VPS (e.g. to Google Drive) so a VPS failure can't take
  your only copy of the data with it.
- To add a second admin (e.g. for a staff member), just run `seedAdmin.js` again with a
  different username.

## Exporting your data

Click **Export CSV** in the top bar any time — it downloads every student and payment
record as a spreadsheet you can open in Excel/Google Sheets. There's also the `mysqldump`
backup above, which is a full database backup (use that for disaster recovery; use the CSV
export for everyday "I want a spreadsheet" needs).

## Day-to-day maintenance

- **Server crashes / VPS reboots**: PM2 (`pm2 save` + `pm2 startup`) restarts the app
  automatically. MySQL stores data on disk, so a restart doesn't lose anything that was
  already saved.
- **Updating the code later**: edit files, then for backend changes run
  `pm2 restart ghazala-fee-crm`; for frontend changes run `npm run build` again inside
  `client/` (nginx picks up the new static files immediately, no restart needed).
