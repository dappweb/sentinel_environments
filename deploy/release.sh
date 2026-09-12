#!/usr/bin/env bash
set -euo pipefail

revision=${1:?Pass a tested full commit SHA}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || exit 2
test -f /opt/microhood/.env
mkdir -p /opt/microhood/releases
exec 9>/opt/microhood/releases/deploy.lock
flock -n 9 || { echo 'Another release is running'; exit 1; }
release_dir=$(mktemp -d "/opt/microhood/releases/${revision}-XXXXXX")
curl --fail --location --retry 3 --output "$release_dir/source.tgz" \
  "https://github.com/dappweb/sentinel_environments/archive/${revision}.tar.gz"
tar -xzf "$release_dir/source.tgz" --strip-components=1 -C "$release_dir"
export RELEASE_REVISION="$revision"
compose=(docker compose -p microhood --env-file /opt/microhood/.env -f "$release_dir/docker-compose.production.yml")
previous_web=$(docker inspect microhood-frontend-1 --format '{{.Image}}')
previous_api=$(docker inspect microhood-api-1 --format '{{.Image}}')
previous_compose=/opt/microhood/docker-compose.production.yml
if [ -f /opt/microhood/releases/current-directory ]; then
  previous_directory=$(cat /opt/microhood/releases/current-directory)
  [[ "$previous_directory" == /opt/microhood/releases/* ]] || exit 2
  previous_compose="$previous_directory/docker-compose.production.yml"
fi
test -f "$previous_compose"
docker image tag "$previous_web" "microhood-frontend:rollback-${revision}"
docker image tag "$previous_api" "microhood-api:rollback-${revision}"
printf '%s\n' "$previous_web" "$previous_api" > "$release_dir/previous-images.txt"

# Build before stopping any currently healthy service.
"${compose[@]}" build api frontend
rollback() {
  echo 'Release failed; restoring previous images'
  docker image tag "$previous_web" microhood-frontend:latest
  docker image tag "$previous_api" microhood-api:latest
  docker compose -p microhood --env-file /opt/microhood/.env -f "$previous_compose" \
    up -d --no-build --no-deps api frontend
}
trap rollback ERR
"${compose[@]}" up -d --no-build --no-deps api frontend
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1/healthz >/dev/null &&
     curl -fsS http://127.0.0.1/api/chain/robinhood/config >/dev/null &&
     curl -fsS http://127.0.0.1/version.json | python3 -c \
       'import json,sys; assert json.load(sys.stdin)["revision"] == sys.argv[1]' "$revision" &&
     [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/api/status)" = 403 ]; then
    printf '%s\n' "$revision" > /opt/microhood/releases/current-revision
    printf '%s\n' "$release_dir" > /opt/microhood/releases/current-directory
    trap - ERR
    echo "Healthy release: $revision"
    exit 0
  fi
  sleep 2
done
false
