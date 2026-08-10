# SPIN API on Synology + Cloudflare Tunnel

Shared room for a few friends. **No accounts.** Everyone uses the same room code, then picks or creates their own profile. Likes only train that profile’s recommendations; friends can still browse each other’s like/dislike lists.

## 1. Run the API on Synology (Docker)

Copy the `server/` folder to your NAS, e.g. `/volume1/docker/spin-api`.

In Container Manager / Docker:

```bash
cd /volume1/docker/spin-api
docker compose up -d --build
```

- API: `http://NAS_LAN_IP:8787/health` should return `{"ok":true,...}`
- Data is stored in `./data` (map this to a shared folder you back up)

Optional env in `docker-compose.yml`:

- `SPIN_MAX_PROFILES` — default `8`

## 2. Expose it with Cloudflare Tunnel (free)

1. Create a free Cloudflare account and add a domain (or use a free trycloudflare quick tunnel for testing).
2. On the NAS (or a small always-on container), install `cloudflared`.
3. Create a tunnel that points to `http://spin-api:8787` (or `http://127.0.0.1:8787`).
4. Give it a public hostname, e.g. `https://spin-api.yourdomain.com`.

Quick test tunnel (temporary URL):

```bash
docker run --rm -it cloudflare/cloudflared:latest tunnel --url http://host.docker.internal:8787
```

Use the printed `https://….trycloudflare.com` URL as the API URL in SPIN.

## 3. Point the website at your API

Edit `public/config.json` before building/deploying Pages:

```json
{
  "apiUrl": "https://spin-api.yourdomain.com"
}
```

Friends can also paste the API URL once on the join screen (it’s remembered on their phone).

## 4. How friends join

1. Open the SPIN site
2. Enter **API URL** (if not prefilled) + **room code** (e.g. `DRIVE-CREW`)
3. **Pick their name** if it already exists, or **Create profile**
4. Spin / search / like as usual

Their taste syncs to your NAS. App updates on GitHub Pages do **not** wipe the room data.

## Security notes

- Room code is the only “password” — pick something non-obvious and only share with friends
- Prefer Cloudflare Access (optional free email OTP) later if you want an extra gate
- Keep NAS packages updated; back up the `data/` folder
