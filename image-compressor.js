/**
 * Image Compressor & Optimizer
 * Kompresi gambar sisi klien menggunakan HTML5 Canvas API sebelum diunggah ke storage.
 * Sangat menghemat bandwidth HP, mempercepat proses upload, dan menghemat kuota Supabase Storage.
 */

const ImageCompressor = {
    /**
     * Kompres file gambar
     * @param {File} file - Berkas file asli dari input file
     * @param {Object} options - Pengaturan kompresi (maxWidth, maxHeight, quality)
     * @returns {Promise<Blob>} - Blob gambar terkompresi (format image/jpeg atau webp)
     */
    async compress(file, options = {}) {
        const maxWidth = options.maxWidth || 1600;
        const maxHeight = options.maxHeight || 1600;
        const quality = options.quality !== undefined ? options.quality : 0.82;

        // Jika bukan file gambar, kembalikan file asli
        if (!file.type.match(/image.*/)) {
            return file;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;

                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    // Hitung rasio aspek baru jika melebihi batas maksimal
                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    // Smoothing kualitas tinggi
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);

                    // Ekspor ke format JPEG dengan rasio kualitas optimal
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                resolve(file); // Fallback ke file asli jika gagal
                                return;
                            }
                            resolve(blob);
                        },
                        'image/jpeg',
                        quality
                    );
                };

                img.onerror = (err) => reject(err);
            };

            reader.onerror = (err) => reject(err);
        });
    },

    /**
     * Format ukuran byte ke string terbaca (KB, MB)
     */
    formatBytes(bytes, decimals = 1) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
};

window.ImageCompressor = ImageCompressor;
