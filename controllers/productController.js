const { getDbPool } = require('../database');

// Use CommonJS exports so this file works with require()
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getDbPool();
        const query = `
        SELECT 
          id_produk , 
          nama , 
          deskripsi , 
          harga , 
          stok , 
          gambar AS image_url 
        FROM Produk 
        WHERE id_produk = ?`;
        const [rows] = await db.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error(`Failed to fetch product ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error fetching product.' });
    }
};

const addProduct = async (req, res) => {
    try {
        const { nama, kategori, deskripsi, harga, stok, gambar } = req.body;

        // PERBAIKAN 1: Validasi disesuaikan (hanya cek yang wajib)
        if (!nama || !kategori || !deskripsi || !harga) {
            return res.status(400).json({ message: 'Nama, kategori, deskripsi, dan harga wajib diisi!' });
        }

        const db = await getDbPool();

        // Cek duplikat
        const [existingProduct] = await db.query('SELECT id_produk FROM Produk WHERE nama = ?', [nama]);
        if (existingProduct.length > 0) {
            return res.status(409).json({ message: 'Produk dengan nama ini sudah ada.' });
        }

        // Insert produk baru
        const [result] = await db.query(
            'INSERT INTO Produk (nama, kategori, deskripsi, harga, stok, gambar) VALUES (?, ?, ?, ?, ?, ?)',
            [nama, kategori, deskripsi, harga, stok, gambar]
        );

        res.status(201).json({
            message: 'Produk telah dimasukkan',
            produkID: result.insertId
        });
    } catch (error) {
        console.error('Gagal menambah produk:', error);
        res.status(500).json({ message: 'Server Error saat penambahan.' });
    }
};

const getProductAll = async (req, res) => {
    try {
        const db = await getDbPool();
        const query = `
        SELECT 
            id_produk,
            nama, 
            deskripsi,
            harga,
            stok,
            gambar
        FROM Produk
        WHERE stok >= 0`;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Gagal mencari produk:', error);
        res.status(500).json({ message: 'Server Error Fetching product from database.' });
    }
};

module.exports = {
    getProductById,
    addProduct,
    getProductAll,
};