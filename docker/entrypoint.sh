#!/bin/sh
set -eu

umask 077

config_file=/tmp/treetop-config.js
proxy_file=/tmp/treetop-proxy.conf
targets_file=/tmp/treetop-proxy-targets.json
tokens_file=/tmp/treetop-proxy-tokens.json

api_url=${TREETOP_API_URL:-/treetop-api}
server_profiles=${TREETOP_SERVER_PROFILES:-}
active_server=${TREETOP_ACTIVE_SERVER:-}
default_target=${TREETOP_PROXY_TARGET:-}
configured_targets=${TREETOP_PROXY_TARGETS:-}
default_token=${TREETOP_PROXY_ACCESS_TOKEN:-}
configured_tokens=${TREETOP_PROXY_ACCESS_TOKENS:-}

if [ -z "$configured_targets" ]; then configured_targets='{}'; fi
if [ -z "$configured_tokens" ]; then configured_tokens='{}'; fi

if [ -n "$server_profiles" ] && ! printf '%s' "$server_profiles" \
  | jq -e 'type == "array" or (type == "object" and (.servers | type == "array"))' >/dev/null; then
  printf '%s\n' 'TREETOP_SERVER_PROFILES must be a JSON server array or configuration object.' >&2
  exit 1
fi

{
  printf '%s' 'window.__TREETOP_CONFIG__ = Object.freeze('
  jq -cn \
    --arg apiUrl "$api_url" \
    --arg serverProfiles "$server_profiles" \
    --arg activeServer "$active_server" \
    '{apiUrl: $apiUrl}
      + (if $serverProfiles == "" then {} else {serverProfiles: $serverProfiles} end)
      + (if $activeServer == "" then {} else {activeServer: $activeServer} end)'
  printf '%s\n' ');'
} > "$config_file"

if ! printf '%s' "$configured_targets" | jq -e '
  type == "object" and all(to_entries[];
    (.key | test("^/[A-Za-z0-9._~/-]+$") and . != "/")
    and (.value | type == "string" and test("^https?://[A-Za-z0-9._~:/\\[\\]@!&()*+,=%-]+/?$"))
  )' >/dev/null; then
  printf '%s\n' 'TREETOP_PROXY_TARGETS must map safe URL paths to HTTP(S) upstream URLs.' >&2
  exit 1
fi
printf '%s' "$configured_targets" | jq '.' > "$targets_file"

if [ -n "$default_target" ]; then
  if ! printf '%s' "$api_url" | jq -R -e 'test("^/[A-Za-z0-9._~/-]+$") and . != "/"' >/dev/null \
    || ! printf '%s' "$default_target" | jq -R -e \
      'test("^https?://[A-Za-z0-9._~:/\\[\\]@!&()*+,=%-]+/?$")' >/dev/null; then
    printf '%s\n' 'TREETOP_PROXY_TARGET requires a path TREETOP_API_URL and a safe HTTP(S) URL.' >&2
    exit 1
  fi
  jq --arg prefix "$api_url" --arg target "$default_target" \
    '{($prefix): $target} + .' "$targets_file" > "${targets_file}.new"
  mv "${targets_file}.new" "$targets_file"
fi

if ! printf '%s' "$configured_tokens" | jq -e '
  type == "object" and all(to_entries[];
    (.key | test("^/[A-Za-z0-9._~/-]+$") and . != "/")
    and (.value | type == "string" and test("^[A-Za-z0-9._~+/=-]+$"))
  )' >/dev/null; then
  printf '%s\n' 'TREETOP_PROXY_ACCESS_TOKENS must map URL paths to valid Bearer tokens.' >&2
  exit 1
fi
printf '%s' "$configured_tokens" | jq '.' > "$tokens_file"

if [ -n "$default_token" ] && ! printf '%s' "$default_token" \
  | jq -R -e 'test("^[A-Za-z0-9._~+/=-]+$")' >/dev/null; then
  printf '%s\n' 'TREETOP_PROXY_ACCESS_TOKEN contains invalid Bearer-token characters.' >&2
  exit 1
fi

# Normalize trailing slashes after validation so proxy_pass URI replacement is predictable.
jq 'with_entries(.key |= sub("/+$"; "") | .value |= sub("/+$"; ""))' \
  "$targets_file" > "${targets_file}.new"
mv "${targets_file}.new" "$targets_file"
jq 'with_entries(.key |= sub("/+$"; ""))' "$tokens_file" > "${tokens_file}.new"
mv "${tokens_file}.new" "$tokens_file"

: > "$proxy_file"

write_proxy_location() {
  match=$1
  upstream=$2
  authorization=${3:-}
  {
    printf '    location %s {\n' "$match"
    if [ -n "$authorization" ]; then
      printf '        proxy_set_header Authorization "Bearer %s";\n' "$authorization"
    fi
    # These are nginx variables and must remain literal while this shell runs.
    # shellcheck disable=SC2016
    printf '%s\n' \
      '        proxy_http_version 1.1;' \
      '        proxy_ssl_server_name on;' \
      '        proxy_set_header X-Real-IP $remote_addr;' \
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
      '        proxy_set_header X-Forwarded-Proto $scheme;'
    printf '        proxy_pass %s;\n' "$upstream"
    printf '%s\n' '    }'
  } >> "$proxy_file"
}

jq -r 'to_entries | sort_by(.key)[] | [.key, .value] | @tsv' "$targets_file" \
  | while IFS="$(printf '\t')" read -r prefix target; do
      token=$(jq -r --arg prefix "$prefix" '.[$prefix] // empty' "$tokens_file")
      if [ -z "$token" ]; then token=$default_token; fi

      write_proxy_location "= ${prefix}/api/v1" "${target}/api/v1" "$token"
      write_proxy_location "^~ ${prefix}/api/v1/" "${target}/api/v1/" "$token"
      write_proxy_location "= ${prefix}/metrics" "${target}/metrics" "$token"
      write_proxy_location "^~ ${prefix}/" "${target}/" ""
  done

exec "$@"
