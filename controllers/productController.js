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
          gambar
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

const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { nama, deskripsi, harga, stok, gambar } = req.body || {};
        const fields  = [];
        const values = [];
        if (nama !== undefined ) {
            fields.push('nama = ?');
            values.push(nama);
        }
        if (deskripsi !== undefined ) {
            fields.push('deskripsi = ?');
            values.push(deskripsi);
        }
        if (harga !== undefined ) {
            fields.push('harga = ?');
            values.push(harga);
        }
        if (stok !== undefined ) {
            fields.push('stok = ?');
            values.push(stok);
        }
        if (gambar !== undefined ) {
            fields.push('gambar = ?');
            values.push(gambar);
        }
        if (fields.length === 0) {
            return res.status(404).json({ message: 'No changes found, allowed are: nama, deskripsi, harga, stok, gambar' });
        };
        const db = await getDbPool();

        const [existing] = await db.query('SELECT id_produk FROM Produk WHERE id_produk = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        const sql = `UPDATE Produk SET ${fields.join(', ')} WHERE id_produk = ?`;
        await db.query(sql, [...values, id]);

        const [rows] = await db.query('SELECT id_produk, nama, deskripsi, harga, stok, gambar FROM Produk WHERE id_produk = ?', [id]);
        return res.json({message: 'Produk sudah terupdate sukses!', user: rows[0]});
    }catch (error) {
        console.error(`Failed to update product ${req.params.id}:`, error);
        return res.status(500).json({message:'Error updating product '+req.params.id});
    }
}

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

const deleteProduct = async (req, res) => {
    try {
        const {id} = req.params;
        if (!id || !/^\d+$/.test(String(id))) {
            return res.status(400).json({ message: 'ID Produk tidak valid.' });
        }
        const db = await getDbPool();
        const [existing] = await db.query('SELECT id_produk FROM Produk WHERE id_produk = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({message: 'Produk tidak ditemukan'})
        }
        await db.query('DELETE FROM Produk WHERE id_produk = ?', [id]);
        return res.status(200).json({message:'Produk telah di delete dari db'})

    }catch(error) {
        console.error('Gagal mencari produk:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(404).json({message: 'Produk sudah terkait di pesanan'})
        }
        return res.status(500).json({message:'Server Error saat penghapusan'})
    }
}

module.exports = {
    getProductById,
    addProduct,
    getProductAll,
    updateProduct,
    deleteProduct,
};