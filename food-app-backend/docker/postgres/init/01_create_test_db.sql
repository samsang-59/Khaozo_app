-- Runs once, the first time the Postgres volume is created.
-- The main DB (food_app) is created by POSTGRES_DB; this adds the test DB.
CREATE DATABASE food_app_test;
