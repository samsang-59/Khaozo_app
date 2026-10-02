# PostgreSQL 17 + PostGIS + pgvector (no official image has both).
#
# Verified at setup (2 Oct 2026):
# - postgis/postgis:17-3.5 is built on Debian bullseye, whose PGDG apt repo is gone
#   (404) → `apt-get install postgresql-17-pgvector` fails. Not usable.
# - Official postgres:17-bookworm already has the PGDG repo configured; bookworm-pgdg
#   ships postgresql-17-postgis-3 (PostGIS 3.6.x) and postgresql-17-pgvector (0.8.x).
# - apt runs over HTTPS: some networks block plain-HTTP apt downloads. The postgres
#   image has no CA bundle, so it is copied from a tiny Alpine stage first.
# pg_trgm is built into Postgres (contrib).
FROM alpine:3 AS certs

FROM postgres:17-bookworm

COPY --from=certs /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

RUN sed -i 's|http://|https://|g' /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       postgresql-17-postgis-3 \
       postgresql-17-postgis-3-scripts \
       postgresql-17-pgvector \
    && rm -rf /var/lib/apt/lists/*
