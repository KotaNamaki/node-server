// controllers/ulasanController.js
const { getDbPool } = require('../database');

// Get ulasan by produk (Publik)
const getUlasanByProduk = async (req, res) => {
    try {
        const { idProduk } = req.params;
        const db = await getDbPool();
        // Join dengan User untuk dapat nama
        const [rows] = await db.query(
            `SELECT u.id_ulasan, u.rating, u.komentar, usr.nama 
             FROM Ulasan u 
             JOIN User usr ON u.id_user = usr.user_id
             WHERE u.id_produk = ?`,
            [idProduk]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// Add ulasan (Customer)
const addUlasan = async (req, res) => {
    try {
        const id_user = req.user.userId; // Dari middleware authReq
        const { id_produk, id_layanan, rating, komentar } = req.body;

        if (!rating || !komentar) {
            return res.status(400).json({ message: 'Rating dan komentar wajib diisi.' });
        }
        if (!id_produk && !id_layanan) {
            return res.status(400).json({ message: 'Produk atau Layanan harus dipilih.' });
        }

        const db = await getDbPool();
        await db.query(
            'INSERT INTO Ulasan (id_user, id_produk, id_layanan, rating, komentar) VALUES (?, ?, ?, ?, ?)',
            [id_user, id_produk || null, id_layanan || null, rating, komentar]
        );
        res.status(201).json({ message: 'Ulasan ditambahkan.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

const getAllUlasan = async (req, res) => {
    try {
        const db = await getDbPool();
        // Query untuk mengambil semua ulasan + nama user + nama produk/layanan (opsional)
        // Kita gunakan LEFT JOIN agar jika produk/layanan dihapus, ulasan tetap muncul (atau sesuaikan kebutuhan)
        const query = `
            SELECT 
                u.id_ulasan AS id, 
                u.rating, 
                u.komentar, 
                u.id_user,
                usr.nama AS nama_user,
                u.id_produk,
                p.nama AS nama_produk,
                u.id_layanan,
                l.nama_layanan AS nama_layanan
            FROM Ulasan u
            LEFT JOIN User usr ON u.id_user = usr.user_id
            LEFT JOIN Produk p ON u.id_produk = p.id_produk
            LEFT JOIN Layanan_modifikasi l ON u.id_layanan = l.id_layanan
        `;
        const [rows] = await db.query(query);

        // Header Content-Range wajib untuk React-Admin list view
        res.set('Content-Range', `ulasan 0-${rows.length}/${rows.length}`);
        res.set('Access-Control-Expose-Headers', 'Content-Range');

        res.json(rows);
    } catch (error) {
        console.error('Failed to fetch all ulasan:', error);
        res.status(500).json({ message: 'Server Error fetching ulasan.' });
    }
};

// ... (jangan lupa tambahkan getAllUlasan ke module.exports di bawah)

// Delete ulasan (Admin)
const deleteUlasan = async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getDbPool();
        const [result] = await db.query('DELETE FROM Ulasan WHERE id_ulasan = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Ulasan tidak ditemukan.' });
        }
        res.json({ message: 'Ulasan dihapus.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getUlasanByProduk,
    addUlasan,
    deleteUlasan,
    getAllUlasan
};