#!/bin/sh
set -eu
# Empty SPRING_DATASOURCE_* from GitHub Secrets/env_file override Spring defaults
# and crash the JVM ("Failed to determine a suitable driver class").
if [ -z "${SPRING_DATASOURCE_URL:-}" ]; then
  unset SPRING_DATASOURCE_URL || true
  unset SPRING_DATASOURCE_USERNAME || true
  unset SPRING_DATASOURCE_PASSWORD || true
fi
exec java -Djava.security.egd=file:/dev/./urandom -jar /app/app.jar
