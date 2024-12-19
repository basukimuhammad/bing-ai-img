const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // Tambahkan library CORS

const app = express();
const PORT = 3000;

// Folder untuk menyimpan gambar
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir); // Buat folder jika belum ada
}

// Middleware untuk mengizinkan CORS
app.use(cors()); // Mengizinkan semua origin
// Jika ingin lebih spesifik, gunakan seperti ini:
// app.use(cors({ origin: 'http://your-allowed-origin.com' }));

// Middleware untuk menyajikan file dari folder "images"
app.use('/images', express.static(imagesDir));

// Fungsi untuk menghapus file yang lebih lama dari 24 jam
const deleteOldFiles = (folder, ageInHours) => {
    const now = Date.now();
    const files = fs.readdirSync(folder);

    files.forEach(file => {
        const filePath = path.join(folder, file);
        const stats = fs.statSync(filePath);
        const fileAgeInHours = (now - stats.mtimeMs) / (1000 * 60 * 60);

        if (fileAgeInHours > ageInHours) {
            fs.unlinkSync(filePath);
            console.log(`File ${file} dihapus karena lebih dari 24 jam.`);
        }
    });
};

// Jalankan penghapusan file lama setiap jam
setInterval(() => deleteOldFiles(imagesDir, 24), 60 * 60 * 1000);

// Endpoint utama
app.get('/', (req, res) => {
    res.send('Selamat datang di API Text-to-Image! Gunakan /txt2img?text={prompt}');
});

// Endpoint txt2img
app.get('/txt2img', async (req, res) => {
    const prompt = req.query.text; // Mengambil prompt dari query parameter
    if (!prompt) {
        return res.status(400).json({
            status: 'error',
            message: 'Parameter "text" tidak disediakan. Harap tambahkan query ?text=prompt-anda',
        });
    }

    try {
        // Mengambil gambar dari API eksternal
        const response = await axios.get(`https://btch.us.kg/bingimg?text=${encodeURIComponent(prompt)}`);
        const results = response.data.result; // Array hasil gambar

        if (!results || results.length === 0) {
            return res.status(500).json({
                status: 'error',
                message: 'Gagal mendapatkan gambar dari API.',
            });
        }

        // Simpan gambar ke folder "images"
        const savedImages = [];
        const host = req.headers.host; // Mendapatkan domain atau IP server
        const protocol = req.protocol; // Mendapatkan protokol (http/https)

        for (let i = 0; i < results.length; i++) {
            const imageUrl = results[i];
            const imageName = `${Date.now()}-${path.basename(imageUrl)}`;
            const savePath = path.join(imagesDir, imageName);

            const imageResponse = await axios.get(imageUrl, { responseType: 'stream' });
            const writer = fs.createWriteStream(savePath);

            imageResponse.data.pipe(writer);

            // Tunggu hingga selesai menulis file
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Tambahkan URL lokal ke daftar gambar yang disimpan
            savedImages.push(`${protocol}://${host}/images/${imageName}`);
        }

        res.json({
            status: 'success',
            creator: 'Basuki',
            prompt: prompt,
            images: savedImages, // Daftar URL gambar yang dihasilkan
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 'error',
            message: 'Terjadi kesalahan pada server.',
            details: error.message,
        });
    }
});

// Menjalankan server
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
