# Deploying CodeAtlas to the VS Code Marketplace

## One-time setup

### 1. Create a publisher
1. Sign in at https://marketplace.visualstudio.com/manage
2. Click **Create publisher** — choose an ID (e.g. `your-name`)
3. Update `"publisher"` in `package.json` to match that ID

### 2. Create a Personal Access Token (PAT)
1. Go to https://dev.azure.com → Your account → User Settings → Personal Access Tokens
2. New Token → Scopes: **Marketplace → Manage** (and optionally Read)
3. Copy the token — you only see it once

### 3. Log in with vsce
```bash
npx vsce login <your-publisher-id>
# paste the PAT when prompted
```

---

## Building & publishing

```bash
# Install deps (first time)
npm install

# Build the extension bundle
npm run build

# Package into a .vsix (for testing or manual upload)
npm run package
# → produces codeatlas-extension-0.3.0.vsix

# Publish directly to the Marketplace
npx vsce publish
# or bump the patch version and publish in one step:
npx vsce publish patch
```

---

## Testing locally before publishing

```bash
# Install the .vsix into your own VS Code
code --install-extension codeatlas-extension-0.3.0.vsix
```

Or drag-and-drop the `.vsix` onto the Extensions sidebar in VS Code.

---

## Checklist before publishing

- [ ] `"publisher"` in `package.json` matches your Marketplace publisher ID
- [ ] `"version"` bumped appropriately (semver)
- [ ] `CHANGELOG.md` updated with release notes
- [ ] `README.md` has at least one screenshot (Marketplace shows it prominently)
- [ ] `icon.png` is 128×128 px minimum (currently included ✓)
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] Tested locally with `code --install-extension …vsix`

---

## Neo4j Aura (cloud) tip

For users who don't want to run Neo4j locally, they can use **Neo4j Aura Free**:
1. https://neo4j.com/cloud/platform/aura-graph-database/
2. Create a free instance → copy the connection URI
3. Set `NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io` in `.env`

---

## GitHub Actions CI (optional)

Create `.github/workflows/publish.yml`:

```yaml
name: Publish Extension
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - run: npx vsce publish --pat ${{ secrets.VSCE_PAT }}
```

Add `VSCE_PAT` as a repository secret.
