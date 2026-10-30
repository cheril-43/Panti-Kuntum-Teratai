/**
 * Supabase Client Configuration & Helper Library
 * Panti Asuhan Kuntum Teratai
 * 
 * CATATAN KEAMANAN:
 * - Kunci yang digunakan di sini HANYA Anon (Public) Key, BUKAN Service Role Key!
 * - Keamanan data 100% ditegakkan di server database melalui Row Level Security (RLS)
 *   dan Storage Policies yang ada di file /supabase/schema.sql.
 */

// Konfigurasi default (Ditanamkan langsung agar website & dasbor langsung terhubung tanpa konfigurasi manual)
const DEFAULT_SUPABASE_URL = window.__SUPABASE_URL__ || localStorage.getItem('KT_SUPABASE_URL') || 'https://rcwlegfvfjnmrzwsjots.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || localStorage.getItem('KT_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd2xlZ2Z2ZmpubXJ6d3Nqb3RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MjA0NzcsImV4cCI6MjA4ODA5NjQ3N30.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd2xlZ2Z2ZmpubXJ6d3Nqb3RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MjA0NzcsImV4cCI6MjA4ODA5NjQ3N30';

class SupabaseService {
    constructor() {
        this.url = DEFAULT_SUPABASE_URL;
        this.anonKey = DEFAULT_SUPABASE_ANON_KEY;
        this.client = null;
        this.initClient();
    }

    initClient() {
        if (this.url && this.anonKey && window.supabase) {
            try {
                this.client = window.supabase.createClient(this.url, this.anonKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                });
            } catch (err) {
                console.error('Gagal inisialisasi Supabase client:', err);
            }
        }
    }

    setCredentials(url, anonKey) {
        this.url = url.trim();
        this.anonKey = anonKey.trim();
        localStorage.setItem('KT_SUPABASE_URL', this.url);
        localStorage.setItem('KT_SUPABASE_ANON_KEY', this.anonKey);
        this.initClient();
    }

    isConfigured() {
        return Boolean(this.url && this.anonKey && this.client);
    }

    getClient() {
        if (!this.client && this.isConfigured()) {
            this.initClient();
        }
        return this.client;
    }

    // --- AUTENTIKASI ---
    async login(email, password) {
        if (!this.isConfigured()) throw new Error('Supabase belum dikonfigurasi.');
        const { data, error } = await this.client.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });
        if (error) throw error;
        return data;
    }

    async logout() {
        if (!this.client) return;
        await this.client.auth.signOut();
    }

    async getSession() {
        if (!this.client) return null;
        const { data } = await this.client.auth.getSession();
        return data.session;
    }

    async getCurrentUserRole() {
        const session = await this.getSession();
        if (!session || !session.user) return null;

        const { data, error } = await this.client
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (error || !data) {
            return null;
        }
        return data.role; // 'owner' atau 'admin'
    }

    // --- PENGELOLAAN ALBUM DOKUMENTASI (PUBLIK & ADMIN) ---
    async getPublishedAlbums() {
        if (!this.isConfigured()) return null;
        const { data, error } = await this.client
            .from('albums')
            .select(`
                id, title, slug, event_date, category, description, cover_url, status, created_at,
                album_photos ( id, photo_url, caption, sort_order )
            `)
            .eq('status', 'published')
            .order('event_date', { ascending: false });

        if (error) {
            console.error('Error fetching published albums:', error);
            return null;
        }

        // Urutkan foto di dalam setiap album berdasarkan sort_order
        if (data) {
            data.forEach(album => {
                if (album.album_photos) {
                    album.album_photos.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                }
            });
        }
        return data;
    }

    async getAllAlbumsAdmin() {
        if (!this.isConfigured()) throw new Error('Supabase belum dikonfigurasi.');
        const { data, error } = await this.client
            .from('albums')
            .select(`
                id, title, slug, event_date, category, description, cover_url, cover_storage_path, status, created_at, updated_at,
                album_photos ( id, photo_url, storage_path, caption, sort_order, file_size )
            `)
            .order('event_date', { ascending: false });

        if (error) throw error;

        if (data) {
            data.forEach(album => {
                if (album.album_photos) {
                    album.album_photos.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                }
            });
        }
        return data;
    }

    // --- UPLOAD FOTO KE STORAGE BUCKET ---
    async uploadPhoto(file, albumSlug) {
        if (!this.isConfigured()) throw new Error('Supabase belum dikonfigurasi.');

        // Kompres gambar terlebih dahulu
        let compressedBlob;
        try {
            compressedBlob = await window.ImageCompressor.compress(file, {
                maxWidth: 1600,
                maxHeight: 1600,
                quality: 0.82
            });
        } catch (compressErr) {
            console.warn('Kompresi gagal, menggunakan file asli:', compressErr);
            compressedBlob = file;
        }

        // Buat nama file unik dan aman
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_').toLowerCase();
        const filePath = `${albumSlug}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${cleanName}`;

        let data, error;
        try {
            ({ data, error } = await this.client.storage
                .from('documentation')
                .upload(filePath, compressedBlob, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: 'image/jpeg'
                }));
        } catch (fetchErr) {
            const msg = fetchErr.message || String(fetchErr);
            throw new Error('Gagal mengunggah ke storage: ' + msg);
        }

        if (error) throw new Error('Storage error: ' + error.message);

        // Dapatkan URL publik
        const { data: publicUrlData } = this.client.storage
            .from('documentation')
            .getPublicUrl(filePath);

        return {
            photo_url: publicUrlData.publicUrl,
            storage_path: filePath,
            file_size: compressedBlob.size
        };
    }

    // Ganti foto sampul album
    async updateAlbumCover(albumId, photoUrl, storagePath = null) {
        if (!this.isConfigured()) throw new Error('Supabase belum dikonfigurasi.');
        const updateData = { cover_url: photoUrl };
        if (storagePath) updateData.cover_storage_path = storagePath;
        const { error } = await this.client
            .from('albums')
            .update(updateData)
            .eq('id', albumId);
        if (error) throw error;
    }

    // --- PENGELOLAAN FOTO ANAK ASUH (KHUSUS ADMIN & OWNER) ---
    async getChildPhotos() {
        const localData = {};
        for (let i = 1; i <= 36; i++) {
            const saved = localStorage.getItem('child_photo_' + i);
            if (saved) localData[i] = saved;
        }

        if (!this.isConfigured()) return localData;

        try {
            const { data, error } = await this.client
                .from('anak_asuh_photos')
                .select('*');

            if (!error && data) {
                data.forEach(item => {
                    localData[item.child_id] = item.photo_url;
                    localStorage.setItem('child_photo_' + item.child_id, item.photo_url);
                });
            }
        } catch (e) {
            // Table might not exist yet, fallback to localStorage
        }
        return localData;
    }

    async saveChildPhoto(childId, photoUrl, storagePath = null) {
        // Simpan di localStorage selalu
        localStorage.setItem('child_photo_' + childId, photoUrl);

        if (!this.isConfigured()) return;

        try {
            await this.client
                .from('anak_asuh_photos')
                .upsert({
                    child_id: childId,
                    photo_url: photoUrl,
                    storage_path: storagePath,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'child_id' });
        } catch (e) {
            console.warn('Gagal sinkron ke tabel anak_asuh_photos:', e);
        }
    }

    // Perbarui keterangan (caption) foto
    async updatePhotoCaption(photoId, caption) {
        if (!this.isConfigured()) throw new Error('Supabase belum dikonfigurasi.');
        const { error } = await this.client
            .from('album_photos')
            .update({ caption: caption.trim() })
            .eq('id', photoId);
        if (error) throw error;
    }

    // Hapus foto dari storage
    async deleteStorageFile(storagePath) {
        if (!this.isConfigured() || !storagePath) return;
        try {
            await this.client.storage.from('documentation').remove([storagePath]);
        } catch (e) {
            console.warn('Gagal menghapus file dari storage:', storagePath, e);
        }
    }
}

// Inisialisasi Singleton
window.supabaseService = new SupabaseService();
