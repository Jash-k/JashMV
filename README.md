# M3U Stremio Addon (Multi-Source)

This is a Stremio addon that allows you to stream movies from multiple M3U playlists. It includes:

- **Multi-Source Support**: Add multiple M3U URLs.
- **Smart Merging**: Groups streams for the same movie from different sources.
- **TMDB Integration**: Enriches content with posters, ratings, and descriptions.
- **Auto-Refresh**: Caches playlists for 10 minutes, then auto-updates on access.
- **Keep-Alive**: Prevents free-tier instances (like Render) from sleeping while active.

## Deployment

### 1. Deploy to Render.com (Free)

1. Fork this repository.
2. Create a new **Web Service** on Render.
3. Connect your repository.
4. Set the following:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Click **Deploy**.

### 2. Configure

1. Once deployed, open your Render URL (e.g., `https://my-addon.onrender.com`).
2. Add your M3U playlist URLs (and optional TMDB Key).
3. Click **Generate Link**.
4. Click **Install on Stremio**.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000`.
