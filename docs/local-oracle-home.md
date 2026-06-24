# Local Oracle Home Base

This checkout is configured for a local-fork Oracle setup where the MacBook runs the actual browser automation, using the signed-in Chrome session on this MacBook. Other machines can call back to this MacBook through `oracle serve`.

## Current Local Install

The shell `oracle` command is linked to this checkout:

```bash
/opt/homebrew/bin/oracle -> /Users/olety/Desktop/code/oracle
```

The active branch is:

```bash
codex/large-file-attachments
```

The fork remote setup is:

```bash
origin   https://github.com/olety/oracle.git
upstream https://github.com/steipete/oracle.git
```

Pushes go to the fork. Upstream is fetch-only locally.

## Intended Usage

Run the Oracle server on the MacBook:

```bash
oracle serve --host 0.0.0.0 --port 9473 --manual-login
```

Then configure other machines to call this MacBook:

```json
{
  "browser": {
    "remoteHost": "MACBOOK_HOST_OR_IP:9473",
    "remoteToken": "TOKEN_FROM_ORACLE_SERVE",
    "remoteAttachmentRoots": ["/Users/olety/OracleUploads"]
  }
}
```

The MacBook also has this local config:

```json
{
  "browser": {
    "remoteAttachmentRoots": ["/Users/olety/OracleUploads"]
  }
}
```

The directory exists locally:

```bash
/Users/olety/OracleUploads
```

## Attachment Behavior

Small files that live only on the calling machine still work through the existing remote broker path: the client reads the file and sends it to `oracle serve`.

Large files should use the shared-root path:

1. Put the file under `/Users/olety/OracleUploads` on the MacBook.
2. Run Oracle with a `--file` path that is visible on the calling machine and resolves to the same shared file path, or run the Oracle command on the MacBook after copying the file there.

When the file path is under a configured `remoteAttachmentRoots` directory, the client sends a path reference instead of base64 file contents. The server checks that `realpath(file)` stays inside an allowlisted root before using it.

## Important Caveat

For a Mac mini or Arc server to pass `--file /Users/olety/OracleUploads/archive.zip`, that path must also exist on the calling machine, because the CLI still validates `--file` inputs before it sends the request.

So the clean large-file options are:

- Mount/sync `/Users/olety/OracleUploads` on the calling machine at the same path.
- Copy the archive to `/Users/olety/OracleUploads` on the MacBook, then run the `oracle` command on the MacBook, for example over SSH.
- Use the existing broker upload path for smaller files where buffering is acceptable.

This setup does not remove the direct `--remote-chrome` DataTransfer limit. The shared-root fix is for the `oracle serve` broker path.

## Pulling Upstream Later

```bash
cd /Users/olety/Desktop/code/oracle
git fetch upstream
git rebase upstream/main
pnpm install
pnpm run build
```

After rebuilding, the linked global `oracle` command uses the rebuilt `dist` from this checkout.
