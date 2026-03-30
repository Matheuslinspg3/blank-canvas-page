-- Fix: Make contract-templates bucket private to prevent unauthenticated access
UPDATE storage.buckets SET public = false WHERE id = 'contract-templates';