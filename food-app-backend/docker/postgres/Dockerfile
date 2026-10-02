# PostgreSQL 17 + PostGIS 3.5 + pgvector (no official image has both).
# Verified at setup (2 Oct 2026): tag postgis/postgis:17-3.5 exists on Docker Hub,
# package postgresql-17-pgvector exists in the PGDG bookworm apt repo.
# pg_trgm is built into Postgres (contrib).
FROM postgis/postgis:17-3.5

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-17-pgvector \
    && rm -rf /var/lib/apt/lists/*
