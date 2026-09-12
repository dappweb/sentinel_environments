# Release management

Develop on `codex/*` branches and open a pull request to `main`. Both named CI jobs must pass before merging. Merged branches are deleted automatically; historical branches are kept until separately reviewed.

`Deploy production` runs only after successful push CI on main and only when repository variable `PRODUCTION_DEPLOY_ENABLED` equals `true`. The default is off. It uses the tested commit SHA, never a mutable branch name. Deployment is serialized both in Actions and on the host.

Configure the `production` environment with:

- `PRODUCTION_SSH_TARGET` variable: SSH user and host reachable from GitHub-hosted runners.
- `PRODUCTION_SSH_KEY` secret: dedicated deployment key authorized on that host.
- `PRODUCTION_KNOWN_HOSTS` secret: host key verified through an existing trusted connection; never disable host verification.

Do not copy a personal SSH private key into Actions. Use a dedicated deployment identity. Secrets in `/opt/microhood/.env` stay on the host. Enable the deployment variable only after the transport and a supervised first deployment have been verified.

`deploy/release.sh <40-character SHA>` downloads the exact public repository snapshot, builds before cutover, records previous image IDs, and checks health, public configuration, version and blocked benchmark API. On failure it restores previous images using the previous compose file. The tunnel service is not restarted. Release directories and rollback images are retained, without automatic destructive cleanup.

`/version.json` and the frontend image revision label identify releases built through this workflow. Existing installations will acquire those markers on their next deployment; configuration changes alone do not update live containers.

This workflow does not back up customer data, deliver external alerts, or prove an untested rollback works. Perform a supervised release and rollback drill before enabling unattended production deployment.
