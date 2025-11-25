-- Add unique constraint to prevent duplicate product titles
ALTER TABLE products ADD CONSTRAINT products_title_unique UNIQUE (title);