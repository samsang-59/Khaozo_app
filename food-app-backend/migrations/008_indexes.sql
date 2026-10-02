-- Up Migration
-- PK / UNIQUE columns are already indexed. Foreign keys are NOT — index the ones we search by.

-- B-tree
CREATE INDEX dish_ratings_menu_item_id_idx      ON dish_ratings (menu_item_id);
CREATE INDEX dish_ratings_user_id_created_idx   ON dish_ratings (user_id, created_at);
CREATE INDEX place_reviews_place_id_idx         ON place_reviews (place_id);
CREATE INDEX menu_items_place_id_idx            ON menu_items (place_id);
CREATE INDEX menu_items_standard_dish_id_idx    ON menu_items (standard_dish_id);
CREATE INDEX places_area_id_idx                 ON places (area_id);
CREATE INDEX photos_dish_rating_id_idx          ON photos (dish_rating_id);
CREATE INDEX photos_place_review_id_idx         ON photos (place_review_id);
CREATE INDEX photos_place_id_idx                ON photos (place_id);
CREATE INDEX login_sessions_user_id_idx         ON login_sessions (user_id);
CREATE INDEX wishlist_items_user_id_idx         ON wishlist_items (user_id);
CREATE INDEX private_notes_user_id_idx          ON private_notes (user_id);
CREATE INDEX standard_dishes_category_id_idx    ON standard_dishes (category_id);
CREATE INDEX place_reports_pending_idx          ON place_reports (status) WHERE status = 'pending';

-- GiST (spatial): near me, distance, nearest area pin, 50 m duplicate check
CREATE INDEX places_location_gist_idx           ON places USING GIST (location);
CREATE INDEX areas_location_gist_idx            ON areas USING GIST (location);

-- HNSW (vector): closest standard dish by cosine distance (<=>)
CREATE INDEX standard_dishes_embedding_hnsw_idx ON standard_dishes USING hnsw (embedding vector_cosine_ops);

-- GIN pg_trgm (fuzzy text): duplicate place check, keyword fallback ("biriyani" → "biryani")
CREATE INDEX places_name_trgm_idx               ON places USING GIN (name gin_trgm_ops);
CREATE INDEX standard_dishes_name_trgm_idx      ON standard_dishes USING GIN (name gin_trgm_ops);
CREATE INDEX dish_aliases_alias_trgm_idx        ON dish_aliases USING GIN (alias gin_trgm_ops);

-- Down Migration
DROP INDEX dish_aliases_alias_trgm_idx;
DROP INDEX standard_dishes_name_trgm_idx;
DROP INDEX places_name_trgm_idx;
DROP INDEX standard_dishes_embedding_hnsw_idx;
DROP INDEX areas_location_gist_idx;
DROP INDEX places_location_gist_idx;
DROP INDEX place_reports_pending_idx;
DROP INDEX standard_dishes_category_id_idx;
DROP INDEX private_notes_user_id_idx;
DROP INDEX wishlist_items_user_id_idx;
DROP INDEX login_sessions_user_id_idx;
DROP INDEX photos_place_id_idx;
DROP INDEX photos_place_review_id_idx;
DROP INDEX photos_dish_rating_id_idx;
DROP INDEX places_area_id_idx;
DROP INDEX menu_items_standard_dish_id_idx;
DROP INDEX menu_items_place_id_idx;
DROP INDEX place_reviews_place_id_idx;
DROP INDEX dish_ratings_user_id_created_idx;
DROP INDEX dish_ratings_menu_item_id_idx;
