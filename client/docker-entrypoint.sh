#!/bin/sh
set -e

# Generate htpasswd file if credentials are provided
if [ -n "$BASIC_AUTH_USERNAME" ] && [ -n "$BASIC_AUTH_PASSWORD" ]; then
  # Use openssl to create htpasswd entry (available in nginx alpine image)
  HASH=$(openssl passwd -apr1 "$BASIC_AUTH_PASSWORD")
  echo "${BASIC_AUTH_USERNAME}:${HASH}" > /etc/nginx/.htpasswd
else
  # If no credentials, disable auth by creating empty file or removing directive
  # For safety, create a dummy that won't match, or better: allow open access
  # by not creating the file - but nginx will fail. So create empty auth that fails.
  # Actually better: if no auth, use a config without auth. For now require auth.
  echo "WARNING: BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD not set"
  # Create empty file - auth will fail for everyone which is safer
  touch /etc/nginx/.htpasswd
fi

# envsubst for nginx template is handled by the default nginx docker entrypoint
# when files are in /etc/nginx/templates/
exec /docker-entrypoint.sh "$@"
