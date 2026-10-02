-- Up Migration
CREATE EXTENSION IF NOT EXISTS postgis;   -- location: GEOGRAPHY points, ST_DWithin, ST_Distance, <->
CREATE EXTENSION IF NOT EXISTS vector;    -- pgvector: embeddings, cosine distance <=>
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy text match: similarity(), % operator

-- Down Migration
DROP EXTENSION IF EXISTS pg_trgm;
DROP EXTENSION IF EXISTS vector;
DROP EXTENSION IF EXISTS postgis;
