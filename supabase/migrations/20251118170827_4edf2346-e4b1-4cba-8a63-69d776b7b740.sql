-- Fix RLS policies to prevent public data exposure

-- 1. Fix comments table: Require authentication to view comments
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;

CREATE POLICY "Authenticated users can view comments" 
ON public.comments 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 2. Fix catalog_config table: Require authentication to read config
DROP POLICY IF EXISTS "Authenticated users can read config" ON public.catalog_config;

CREATE POLICY "Authenticated users can read config" 
ON public.catalog_config 
FOR SELECT 
USING (auth.uid() IS NOT NULL);