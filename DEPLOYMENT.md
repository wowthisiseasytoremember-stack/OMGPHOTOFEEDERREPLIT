# Deployment Guide - Render

## Quick Start (5 minutes)

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub (easiest)

2. **Push Code to GitHub** (if not already there)

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

3. **Deploy on Render**
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will auto-detect `render.yaml` and set everything up
   - Click "Apply"

4. **Set Environment Variables**
   - After deployment starts, go to your web service
   - Navigate to "Environment" tab
   - Add `GOOGLE_API_KEY` (get from [Google AI Studio](https://aistudio.google.com/app/apikey))
   - Database URL is auto-configured

5. **Run Database Migration**
   - In Render dashboard, go to your web service
   - Click "Shell" tab
   - Run: `npm run db:push`

6. **Done!** Your app is live at the URL shown in Render dashboard

## Environment Variables Needed

| Variable         | Description           | Where to Get                                               |
| ---------------- | --------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection | Auto-configured by Render                                  |
| `GOOGLE_API_KEY` | Google AI API key     | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `NODE_ENV`       | Environment mode      | Auto-set to `production`                                   |
| `PORT`           | Server port           | Auto-configured by Render                                  |

## Troubleshooting

**Build fails?**

- Check that `package.json` has all dependencies
- Verify build command works locally: `npm run build`

**Database connection error?**

- Wait 2-3 minutes for database to fully provision
- Check that database is in "Available" status

**App crashes on start?**

- Check logs in Render dashboard
- Verify `GOOGLE_API_KEY` is set
- Run database migration: `npm run db:push`

## Local Testing (Production Mode)

```bash
npm run build
npm start
```

Visit `http://localhost:5000`
