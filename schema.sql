-- ========================================================
-- SISTEM MANAJEMEN DOKUMENTASI PANTI ASUHAN KUNTUM TERATAI
-- SUPABASE POSTGRESQL SCHEMA + ROW LEVEL SECURITY (RLS)
-- ========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL PERAN PENGGUNA (ROLE-BASED ACCESS CONTROL)
-- Memisahkan role dari auth.users dan memastikan manipulasi role tidak bisa lewat browser biasa
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
    invited_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. FUNGSI KEAMANAN PENGECEKAN HAK AKSES (SECURITY DEFINER)
-- Menghindari infinite recursion pada RLS dan memastikan pengecekan dilakukan di server database
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = check_user_id AND role IN ('owner', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_owner(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = check_user_id AND role = 'owner'
    );
$$;

-- 4. POLICIES UNTUK TABEL user_roles
-- Hanya admin atau owner yang dapat melihat daftar peran
CREATE POLICY "user_roles_select_policy"
ON public.user_roles FOR SELECT
TO authenticated
USING (
    public.is_admin_or_owner(auth.uid()) OR auth.uid() = user_id
);

-- Admin dan Owner dapat menambahkan admin baru
CREATE POLICY "user_roles_insert_policy"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin_or_owner(auth.uid()) AND (
        (role = 'admin') OR (public.is_owner(auth.uid()) AND role = 'owner')
    )
);

-- Hanya Owner yang dapat mengubah atau mencabut hak admin
CREATE POLICY "user_roles_update_policy"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "user_roles_delete_policy"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.is_owner(auth.uid()));

-- 5. TABEL ALBUM DOKUMENTASI KEGIATAN
CREATE TABLE IF NOT EXISTS public.albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    event_date DATE NOT NULL,
    category TEXT NOT NULL DEFAULT 'kegiatan',
    description TEXT,
    cover_url TEXT,
    cover_storage_path TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

-- 6. POLICIES UNTUK TABEL albums
-- Publik dapat melihat album jika berstatus 'published'
CREATE POLICY "albums_public_select"
ON public.albums FOR SELECT
TO anon, authenticated
USING (
    status = 'published' OR (auth.uid() IS NOT NULL AND public.is_admin_or_owner(auth.uid()))
);

-- Hanya Admin dan Owner yang dapat membuat, mengubah, atau menghapus album
CREATE POLICY "albums_admin_insert"
ON public.albums FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "albums_admin_update"
ON public.albums FOR UPDATE
TO authenticated
USING (public.is_admin_or_owner(auth.uid()))
WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "albums_admin_delete"
ON public.albums FOR DELETE
TO authenticated
USING (public.is_admin_or_owner(auth.uid()));

-- 7. TABEL FOTO DI DALAM ALBUM
CREATE TABLE IF NOT EXISTS public.album_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    caption TEXT,
    sort_order INT DEFAULT 0,
    file_size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_album_photos_album_id ON public.album_photos(album_id);
ALTER TABLE public.album_photos ENABLE ROW LEVEL SECURITY;

-- 8. POLICIES UNTUK TABEL album_photos
-- Publik dapat melihat foto jika album induknya berstatus 'published'
CREATE POLICY "album_photos_public_select"
ON public.album_photos FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.albums a
        WHERE a.id = album_photos.album_id
        AND (a.status = 'published' OR (auth.uid() IS NOT NULL AND public.is_admin_or_owner(auth.uid())))
    )
);

CREATE POLICY "album_photos_admin_insert"
ON public.album_photos FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "album_photos_admin_update"
ON public.album_photos FOR UPDATE
TO authenticated
USING (public.is_admin_or_owner(auth.uid()))
WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "album_photos_admin_delete"
ON public.album_photos FOR DELETE
TO authenticated
USING (public.is_admin_or_owner(auth.uid()));

-- 9. TRIGGER UPDATE timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_albums_updated_at ON public.albums;
CREATE TRIGGER trigger_albums_updated_at
BEFORE UPDATE ON public.albums
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 10. STORAGE BUCKET DAN POLICIES
-- Pastikan bucket 'documentation' telah dibuat di Supabase Storage sebagai PUBLIC BUCKET
-- Jalankan query berikut di Supabase SQL Editor:
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentation', 'documentation', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy Storage: Publik dapat membaca file
CREATE POLICY "Public Read Documentation Storage"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'documentation');

-- Policy Storage: Hanya admin/owner yang dapat mengunggah file
CREATE POLICY "Admin Upload Documentation Storage"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'documentation' AND public.is_admin_or_owner(auth.uid())
);

-- Policy Storage: Hanya admin/owner yang dapat memperbarui file
CREATE POLICY "Admin Update Documentation Storage"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'documentation' AND public.is_admin_or_owner(auth.uid())
);

-- Policy Storage: Hanya admin/owner yang dapat menghapus file
CREATE POLICY "Admin Delete Documentation Storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'documentation' AND public.is_admin_or_owner(auth.uid())
);

-- 11. TABEL FOTO ANAK ASUH (KHUSUS PENGELOLAAN FOTO ANAK ASUH)
CREATE TABLE IF NOT EXISTS public.anak_asuh_photos (
    child_id INT PRIMARY KEY,
    photo_url TEXT NOT NULL,
    storage_path TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.anak_asuh_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anak_asuh_public_select"
ON public.anak_asuh_photos FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "anak_asuh_admin_write"
ON public.anak_asuh_photos FOR ALL
TO authenticated
USING (public.is_admin_or_owner(auth.uid()))
WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- ========================================================
-- CATATAN PENDAFTARAN OWNER PERTAMA:
-- 1. Buat akun pertama melalui menu Supabase Auth -> Users -> Add User (masukkan email & password)
-- 2. Salin UUID pengguna tersebut, lalu jalankan SQL berikut untuk menetapkannya sebagai Owner:
-- INSERT INTO public.user_roles (user_id, email, role)
-- VALUES ('<UUID_PENGGUNA_DARI_AUTH_USERS>', 'email.organisasi@gmail.com', 'owner');
-- ========================================================
