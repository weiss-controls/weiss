#!/bin/sh
set -e

export SSH_KEY_PATH="$HOME/.ssh/ssh_key"
export SSH_KNOWN_HOSTS_PATH="$HOME/.ssh/known_hosts"

ssh_available() {
    # Both files must exist and be non-empty
    [ -s "$SSH_KEY_PATH" ] || return 1
    [ -s "$SSH_KNOWN_HOSTS_PATH" ] || return 1
    # Check if private key is valid
    ssh-keygen -l -f "$SSH_KEY_PATH" >/dev/null 2>&1 || return 1
    return 0
}

if ssh_available; then
    export GIT_SSH_COMMAND="ssh -i $SSH_KEY_PATH -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
fi

exec python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
