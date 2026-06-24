# Local Oracle Home Base

This document records the local Oracle setup for using the MacBook as the browser/ChatGPT home base while ArcBox and the Mac Mini do development work remotely.

## Goal

The desired workflow is:

1. A remote development session runs on ArcBox or the Mac Mini.
2. When work is ready for review, that host creates a ZIP archive of the branch/worktree.
3. The host copies the ZIP to the MacBook.
4. The host SSHes into the MacBook and runs `oracle` there.
5. The MacBook uses its signed-in ChatGPT/Chrome profile to run the review.
6. The answer streams back over SSH to the original session.

This keeps the browser session, ChatGPT login, and large archive file local to the MacBook.

## Local Install

The global `oracle` command on this MacBook is linked to this checkout:

```bash
/opt/homebrew/bin/oracle -> /Users/olety/Desktop/code/oracle
```

The active local branch is:

```bash
codex/large-file-attachments
```

The remotes are:

```bash
origin   https://github.com/olety/oracle.git
upstream https://github.com/steipete/oracle.git
```

`origin` is the personal fork and accepts pushes. `upstream` is fetch-only locally.

## Code Changes In This Fork

The first change raised Oracle's default per-file attachment guard from `1 MB` to `500 MB`, while keeping lower explicit overrides working:

- `--max-file-size-bytes`
- `ORACLE_MAX_FILE_SIZE_BYTES`
- `maxFileSizeBytes` in config

The second change added shared attachment roots for the `oracle serve` broker path:

- Clients can send a `serverPath` reference instead of base64 content when the file is under a configured shared root.
- The server independently checks `realpath(file)` stays inside an allowlisted root.
- If the file is not under an allowed root, the old base64 broker path still works.

The shared-root fix is for `oracle serve`. It does not remove the direct `--remote-chrome` DataTransfer limit.

## MacBook Config

The MacBook config is:

```json
{
  "browser": {
    "remoteAttachmentRoots": ["/Users/olety/OracleUploads"],
    "maxConcurrentTabs": 5
  }
}
```

The shared upload folder is:

```bash
/Users/olety/OracleUploads
```

It is local to the MacBook. Remote machines can copy files into it with `rsync`.

## Manual Login Profile

The MacBook manual-login profile was initialized successfully.

Verified command:

```bash
printf 'login smoke' > /Users/olety/OracleUploads/login-smoke.txt
oracle --engine browser --browser-manual-login --browser-keep-browser \
  --prompt "Reply ORACLE_LOGIN_OK" \
  --file /Users/olety/OracleUploads/login-smoke.txt \
  --wait
```

Verified result:

```text
Answer:
ORACLE_LOGIN_OK
```

Use `--browser-manual-login` for SSH-triggered live runs. It is more reliable than normal Chrome cookie extraction from non-interactive SSH sessions.

## Browser Slot Limit

Oracle coordinates shared manual-login profile usage with browser tab slots. The default is `3`; this setup raises it to `5` in `/Users/olety/.oracle/config.json`.

This is a soft safety limit, not a Chrome hard limit. Too many simultaneous ChatGPT tabs can make the UI unstable or trigger account-side throttling, so keep this modest.

Override per run if needed:

```bash
oracle --browser-max-concurrent-tabs 5 ...
```

## Recommended Remote Workflow

From ArcBox or the Mac Mini, create an archive, copy it to the MacBook, then run Oracle on the MacBook over SSH.

Example:

```bash
root=$(git rev-parse --show-toplevel)
repo_name=$(basename "$root")
branch=$(git -C "$root" branch --show-current | tr '/ ' '--')
sha=$(git -C "$root" rev-parse --short HEAD)
ts=$(date -u +%Y%m%dT%H%M%SZ)
zip_name="${repo_name}-${branch}-${sha}-${ts}-oracle-review.zip"

git -C "$root" archive --format=zip -o "/tmp/$zip_name" HEAD

rsync -av --progress "/tmp/$zip_name" \
  olety@100.124.216.116:/Users/olety/OracleUploads/

ssh olety@100.124.216.116 \
  "oracle --engine browser --browser-manual-login \
    --prompt 'Review this branch archive for correctness, regressions, and missing tests.' \
    --file '/Users/olety/OracleUploads/$zip_name' \
    --browser-attachments always \
    --wait"
```

Use the MacBook's Tailscale IP when mDNS is unavailable:

```bash
100.124.216.116
```

## Including Uncommitted Work

`git archive HEAD` only includes committed files. If the development agent leaves changes uncommitted, use a worktree ZIP:

```bash
root=$(git rev-parse --show-toplevel)
repo_name=$(basename "$root")
sha=$(git -C "$root" rev-parse --short HEAD)
ts=$(date -u +%Y%m%dT%H%M%SZ)
zip_name="${repo_name}-${sha}-${ts}-worktree-oracle-review.zip"

cd "$root"
git ls-files -co --exclude-standard -z \
  | xargs -0 zip -q "/tmp/$zip_name"
```

Then `rsync` and SSH-run Oracle the same way.

## What Was Tested

File and broker behavior:

- Local MacBook accepted a synthetic `1.5 MB` ZIP through browser dry-run validation.
- A temporary local broker accepted a `25 MB` ZIP by shared `serverPath`.
- ArcBox reached the MacBook broker with a `25 MB` shared-root payload.
- Mac Mini reached the MacBook broker with a `25 MB` shared-root payload.
- ArcBox actual installed Oracle `0.15.0` reached the MacBook broker with a local `25 MB` ZIP via the legacy base64 path when `ORACLE_MAX_FILE_SIZE_BYTES=524288000` was set.
- Mac Mini actual installed Oracle `0.15.0` reached the MacBook broker with a local `25 MB` ZIP via the legacy base64 path when `ORACLE_MAX_FILE_SIZE_BYTES=524288000` was set.

Orchestration behavior:

- ArcBox created a temporary git repo, made a `2.1 MB` ZIP, `rsync`ed it to `/Users/olety/OracleUploads`, then SSHed into the MacBook and ran `oracle --dry-run` against the uploaded ZIP. Passed.
- Mac Mini created a temporary git repo, made a `2.0 MB` ZIP, `rsync`ed it to `/Users/olety/OracleUploads`, then SSHed into the MacBook and ran `oracle --dry-run` against the uploaded ZIP. Passed.

Live browser behavior:

- Initial SSH-triggered live runs failed because the MacBook browser automation could not use normal Chrome cookies from the SSH context.
- The manual-login setup command succeeded and returned `ORACLE_LOGIN_OK`.
- Future SSH-triggered live runs should use `--browser-manual-login`.

## Known Caveats

Mac Mini and ArcBox currently have Oracle `0.15.0` without this fork's shared-root client code. That is fine for the recommended SSH orchestration, because Oracle runs on the MacBook.

If a remote host calls `oracle --remote-host` locally and passes a huge file that exists only on that remote host, it will use the legacy base64 broker upload path unless that host is updated to this fork and has a shared root mounted at the same path.

For large archives, prefer:

1. `rsync` archive to `/Users/olety/OracleUploads` on the MacBook.
2. SSH into the MacBook.
3. Run MacBook-local `oracle --browser-manual-login`.

This avoids base64 broker buffering and avoids direct `--remote-chrome` DataTransfer limits.

## Pulling Upstream Later

```bash
cd /Users/olety/Desktop/code/oracle
git fetch upstream
git rebase upstream/main
pnpm install
pnpm run build
```

After rebuilding, the linked global `oracle` command uses the rebuilt `dist` from this checkout.

## Useful Checks

Confirm the linked install:

```bash
which oracle
readlink /opt/homebrew/lib/node_modules/@steipete/oracle
oracle --version
```

Confirm the MacBook config:

```bash
cat /Users/olety/.oracle/config.json
```

Confirm the upload folder:

```bash
ls -ld /Users/olety/OracleUploads
```
