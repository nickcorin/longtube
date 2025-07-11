# Release Process

## Version Naming

- **Pre-releases**: `v1.0.0-beta.1`, `v1.0.0-rc.1`
- **Production**: `v1.0.0`

## Pre-Release (Beta Testing)

### 1. Create a pre-release build

```bash
# Update version in manifest.json to match
# Then tag and push
git tag -a v1.0.0-beta.1 -m "Beta release for testing"
git push origin v1.0.0-beta.1
```

### 2. Chrome Web Store Beta Testing

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Upload the `chrome.zip` from GitHub Releases
3. Choose visibility:
   - **Private**: Add specific testers by email (recommended for first beta)
   - **Unlisted**: Share direct link with beta testers

### 3. Collect Feedback

- Monitor GitHub Issues
- Track installation metrics in dashboard
- Test core functionality:
  - [ ] Shorts blocking works
  - [ ] Timer tracking accurate
  - [ ] Settings persist
  - [ ] No performance issues

## Production Release

### 1. Final release build

```bash
# After successful beta testing
git tag -a v1.0.0 -m "Initial public release"
git push origin v1.0.0
```

### 2. Submit to Chrome Web Store

1. Download `chrome.zip` from GitHub Releases
2. Update listing in Developer Dashboard:
   - Change visibility to "Public"
   - Update description if needed
   - Submit for review

### 3. Post-Release

- Monitor reviews and ratings
- Watch for crash reports
- Prepare patch releases if needed (`v1.0.1`)

## Version Checklist

Before any release:
- [ ] Update `version` in `manifest.json`
- [ ] Run `bun test`
- [ ] Test manually in Chrome
- [ ] Update CHANGELOG.md
- [ ] Create git tag
- [ ] Verify GitHub Actions build succeeds