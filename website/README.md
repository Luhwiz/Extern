# ExternAI Website

This is the download page for ExternAI.

## Preview Locally

```bash
cd website
npx http-server . -p 8080 -o
```

## Deploy to Vercel

```bash
cd website
npx vercel
```

Follow the prompts:
- Set up and deploy: Yes
- Which scope: Your account
- Link to existing project: No
- Project name: externai-download
- Directory: `.` (current)
- Override settings: No

Your site will be live at: `https://externai-download.vercel.app`

### Custom Domain

```bash
vercel domains add externai.com
```

## Deploy to Netlify

```bash
cd website
npx netlify-cli deploy --prod
```

Or drag the `website` folder into [Netlify Drop](https://app.netlify.com/drop).

## Deploy to GitHub Pages

Add to `.github/workflows/deploy-website.yml`:

```yaml
name: Deploy Website

on:
  push:
    branches: [ main ]
    paths:
      - 'website/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./website
```

Access at: `https://Luncedo1234.github.io/Extern`

## Update Download Links

If you change repo owner/name, update all GitHub URLs in `index.html`:

```html
https://github.com/YOUR-USERNAME/YOUR-REPO/releases/latest/download/...
```
