#!/bin/sh
set -e

# Config SSH if applicable
if [ -f /root/.ssh/id_rsa ]; then
    export GIT_SSH_COMMAND="ssh -i /root/.ssh/id_rsa -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
fi

python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
