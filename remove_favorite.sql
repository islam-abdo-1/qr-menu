-- Migration: remove_favorite_model
-- Remove unused Favorite model and its table

DROP TABLE IF EXISTS "Favorite" CASCADE;