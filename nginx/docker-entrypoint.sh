#!/bin/sh
set -e

: "${ENABLE_HTTPS:=false}"

if [ "$ENABLE_HTTPS" = "true" ]; then
    export SSL_FULLCHAIN="/etc/nginx/certs/fullchain.pem"
    export SSL_PRIVKEY="/etc/nginx/certs/privkey.pem"

    envsubst '$SSL_FULLCHAIN $SSL_PRIVKEY $APP_HOSTNAME' \
      < /etc/nginx/conf.d/default.https.template \
      > /etc/nginx/conf.d/default.conf

    if [ -n "$DOCS_HOSTNAME" ]; then
        envsubst '$SSL_FULLCHAIN $SSL_PRIVKEY $DOCS_HOSTNAME' \
          < /etc/nginx/conf.d/default.docs.template \
          >> /etc/nginx/conf.d/default.conf
        echo "Docs enabled on ${DOCS_HOSTNAME}"
    fi

    echo "HTTPS enabled"
else
    envsubst '$APP_HOSTNAME' \
      < /etc/nginx/conf.d/default.http.template \
      > /etc/nginx/conf.d/default.conf

    echo "HTTPS disabled (HTTP only)"
fi

exec nginx -g 'daemon off;'
