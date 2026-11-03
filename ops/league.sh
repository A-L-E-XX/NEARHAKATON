#!/usr/bin/env bash
# Puts one AI model through every drill in agent/demo/drills.json, one at a time,
# on its own league vault. Expects: VAULT, AGENT, NEAR_AI_MODEL, PHISHBOWL_AGENT_KEY,
# the vault's key in the NEAR CLI keychain, and the agent's npm packages installed.
# League vaults own themselves, so after a failed drill this script can unfreeze
# the vault and carry on with the next drill.
set -euo pipefail
cd "$(dirname "$0")/../agent"

call() { # call METHOD JSON_ARGS DEPOSIT
  near contract call-function as-transaction "$VAULT" "$1" json-args "$2" \
    prepaid-gas '30.0 Tgas' attached-deposit "$3" \
    sign-as "$VAULT" network-config testnet sign-with-legacy-keychain send > /dev/null
}

frozen() {
  near contract call-function as-read-only "$VAULT" get_status json-args '{}' network-config testnet now 2>/dev/null \
    | grep -q '"frozen": true'
}

if frozen; then call unfreeze '{}' '1 yoctoNEAR'; fi
call close_expired_drills '{}' '0 NEAR' || true

: > league.log
for ID in $(node -e 'console.log(require("./demo/drills.json").map(d => d.id).join(" "))'); do
  DECOY=$(node -e 'console.log(require("./demo/drills.json").find(d => d.id === process.argv[1]).decoy)' "$ID")
  LURE=$(node -e 'console.log(require("./demo/drills.json").find(d => d.id === process.argv[1]).lure)' "$ID")
  INBOX="../league-inbox/$ID"
  rm -rf "$INBOX"
  env -u GITHUB_ENV npx tsx src/plan-drill.ts --id "$ID" --out "$INBOX" > /dev/null

  # One-minute drills: whatever the agent doesn't report in time counts as missed.
  HASH=$(printf '%s' "$DECOY" | openssl dgst -sha256 -binary | base64)
  ARGS=$(node -e 'console.log(JSON.stringify({decoy_hash: process.argv[1], lure: process.argv[2], duration_minutes: 1}))' "$HASH" "$LURE")
  if ! call start_drill "$ARGS" '0 NEAR'; then
    echo "[NOT RUN] $ID: couldn't plant the drill" | tee -a league.log
    continue
  fi

  RESULT=$(npx tsx src/run.ts --inbox "$INBOX" --out "out/$ID" 2>&1 | grep -oE '^\[[A-Z ]+\]' | head -1 || true)
  echo "${RESULT:-[ERROR]} $ID: $LURE" | tee -a league.log

  if frozen; then call unfreeze '{}' '1 yoctoNEAR'; fi
done

# Let unreported drills run out, then settle them so the chain records them as missed.
sleep 70
call close_expired_drills '{}' '0 NEAR' || true
