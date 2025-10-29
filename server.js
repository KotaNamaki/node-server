/*
  server.js — Main entry point for the Node.js back‑end application.

  What this file does:
  - Boots an Express application and configures middleware (CORS + JSON body parser).
  - Exposes REST API routes for products and authentication.
  - Uses a pooled MySQL connection that is opened through an SSH tunnel (see database.js).
  - Issues and verifies password hashes (bcrypt) and JSON Web Tokens (JWT) for login.

  Environment variables used (see .env):
  - PORT: HTTP port for this API server.
  - JWT_SECRET: Secret used to sign JWT tokens for authentication.

  Notes:
  - Table names are aligned with your schema: Produk (products) and user (users).
  - Field aliases in SELECT ensure the API response keys match the frontend’s expectation.
*/

const express = require('express'); // Web framework for defining routes and middleware
const cors = require('cors'); // Enables Cross-Origin Resource Sharing (frontend can call this API)
const { getDbPool } = require('./database'); // Pooled DB connector wrapped over an SSH tunnel
require('dotenv').config(); // Loads variables from .env into process.env

const app = express(); // Initialize Express application
const PORT = process.env.PORT || 3000; // HTTP port; default to 3000 when not set

// --- Middleware ---
app.use(cors()); // Allow calls from other origins (e.g., React app on a different port)
app.use(express.json()); // Parse JSON request bodies into req.body
const ProductRoutes = require('./routes/productRoutes');
const UserRoutes = require('./routes/usersRoutes');

// --- API Routes ---

// Health check / hello route to quickly test if the API is online
app.get('/', (req, res) => {
    res.send('E-commerce API is running!');
});

// --- Product Routes (Adjusted for 'Produk' table) ---
/**
 * GET /api/products
 * Returns all products that still have stock, mapped to frontend-friendly field names.
 */
app.use('/api/products', ProductRoutes);
app.use('/api/users', UserRoutes);

/**
 * POST /api/cart
 * Tambah item ke keranjang user. Jika item sudah ada, jumlah akan ditambahkan.
 * Body: { user_id, id_produk, qty }
 */
app.post('/api/cart', async (req, res) => {
    try {
        let connection;
        const { user_id, id_produk, qty } = req.body || {};
        const userId = parseInt(user_id, 10);
        const produkId = parseInt(id_produk, 10);
        const jumlah = parseInt(qty, 10);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ message: 'user_id tidak valid.' });
        }
        if (!Number.isInteger(produkId) || produkId <= 0) {
            return res.status(400).json({ message: 'id_produk tidak valid.' });
        }
        if (!Number.isInteger(jumlah) || jumlah <= 0) {
            return res.status(400).json({ message: 'qty harus bilangan bulat > 0.' });
        }

        const pool = await getDbPool();
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Pastikan user ada
        const [userRows] = await connection.query('SELECT user_id FROM user WHERE user_id = ?', [userId]);
        if (userRows.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }

        // Pastikan produk ada
        const [prodRows] = await connection.query('SELECT id_produk, harga, stok FROM Produk WHERE id_produk = ?', [produkId]);
        if (prodRows.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'Produk tidak ditemukan.' });
        }

        // Cek apakah sudah ada item yang sama di keranjang
        const [existRows] = await connection.query(
            'SELECT id_keranjang, jumlah FROM Keranjang WHERE id_user = ? AND id_produk = ?',
            [userId, produkId]
        );

        if (existRows.length > 0) {
            // Update qty
            const newQty = existRows[0].qty + jumlah;
            await connection.query(
                'UPDATE Keranjang SET jumlah = ?, update_at = NOW() WHERE id_keranjang = ?',
                [newQty, existRows[0].id_keranjang]
            );
        } else {
            // Insert baru
            await connection.query(
                'INSERT INTO Keranjang (id_user, id_produk, jumlah, created_at, update_at) VALUES (?, ?, ?, NOW(), NOW())',
                [userId, produkId, jumlah]
            );
        }

        await connection.commit();
        connection.release();
        return res.status(201).json({ message: 'Item ditambahkan ke keranjang.' });
    } catch (error) {
        console.error('Gagal menambahkan ke keranjang:', error);
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
            connection.release();
        }
        return res.status(500).json({ message: 'Server error saat menambah ke keranjang.' });
    }
});

/**
 * POST /api/orders
 * Membuat pesanan dari seluruh item keranjang milik user.
 * Body: { user_id }
 */
app.post('/api/orders', async (req, res) => {
    let connection;
    try {
        const { user_id } = req.body || {};
        const userId = parseInt(user_id, 10);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ message: 'user_id tidak valid.' });
        }

        const pool = await getDbPool();
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Pastikan user ada
        const [userRows] = await connection.query('SELECT user_id FROM user WHERE user_id = ? FOR UPDATE', [userId]);
        if (userRows.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }

        // Ambil item keranjang
        const [cartItems] = await connection.query(
            'SELECT k.id_produk, k.jumlah, p.harga, p.stok FROM Keranjang k JOIN Produk p ON p.id_produk = k.id_produk WHERE k.id_user = ? FOR UPDATE',
            [userId]
        );

        if (cartItems.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ message: 'Keranjang kosong.' });
        }

        // Validasi stok
        for (const item of cartItems) {
            if (item.stok < item.qty) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ message: `Stok tidak cukup untuk produk ${item.id_produk}.` });
            }
        }

        // Buat pesanan
        const total = cartItems.reduce((sum, it) => sum + (it.harga * it.qty), 0);
        const [orderRes] = await connection.query(
            'INSERT INTO Pesanan (id_user, total_harga, status_pesanan, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            [userId, total, 'menunggu_pembayaran']
        );
        const orderId = orderRes.insertId;

        // Insert item pesanan dan update stok produk
        for (const item of cartItems) {
            await connection.query(
                'INSERT INTO PesananItem (id_pesanan, id_produk, jumlah, harga_satuan, subtotal) VALUES (?, ?, ?, ?, ?)',
                [orderId, item.id_produk, item.qty, item.harga, item.harga * item.qty]
            );
            await connection.query(
                'UPDATE Produk SET stok = stok - ? WHERE id_produk = ?',
                [item.qty, item.id_produk]
            );
        }

        // Kosongkan keranjang
        await connection.query('DELETE FROM Keranjang WHERE id_user = ?', [userId]);

        await connection.commit();
        connection.release();
        return res.status(201).json({ message: 'Pesanan dibuat.', id_pesanan: orderId, total_harga: total, status: 'menunggu_pembayaran' });
    } catch (error) {
        console.error('Gagal membuat pesanan:', error);
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
            connection.release();
        }
        return res.status(500).json({ message: 'Server error saat membuat pesanan.' });
    }
});

/**
 * POST /api/payments
 * Buat pembayaran untuk sebuah pesanan dan tandai pesanan sebagai dibayar.
 * Body: { id_pesanan, method, amount }
 */
app.post('/api/payments', async (req, res) => {
    let connection;
    try {
        const { id_pesanan, method, amount } = req.body || {};
        const orderId = parseInt(id_pesanan, 10);
        const amt = Number(amount);
        const payMethod = (method || '').toString().trim();

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ message: 'id_pesanan tidak valid.' });
        }
        if (!payMethod) {
            return res.status(400).json({ message: 'method pembayaran wajib diisi.' });
        }
        if (!Number.isFinite(amt) || amt <= 0) {
            return res.status(400).json({ message: 'amount tidak valid.' });
        }

        const pool = await getDbPool();
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Ambil pesanan
        const [orderRows] = await connection.query('SELECT id_pesanan, total_harga, status_pesanan FROM Pesanan WHERE id_pesanan = ? FOR UPDATE', [orderId]);
        if (orderRows.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
        }
        const order = orderRows[0];
        if (order.status !== 'menunggu_pembayaran') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ message: 'Pesanan bukan dalam status menunggu_pembayaran.' });
        }
        if (amt < Number(order.total_harga)) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ message: 'Jumlah pembayaran kurang dari total pesanan.' });
        }

        // Simpan pembayaran
        const [payRes] = await connection.query(
            'INSERT INTO Pembayaran (id_pesanan, method, jumlah_bayar, status_bayar, bukti_bayar, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW(), NOW())',
            [orderId, payMethod, amt, 'berhasil']
        );

        // Update pesanan
        await connection.query(
            "UPDATE Pesanan SET status_pesanan = 'dibayar', updated_at = NOW() WHERE id_pesanan = ?",
            [orderId]
        );

        await connection.commit();
        connection.release();
        return res.status(201).json({ message: 'Pembayaran berhasil.', id_pembayaran: payRes.insertId, id_pesanan: orderId, status: 'dibayar' });
    } catch (error) {
        console.error('Gagal memproses pembayaran:', error);
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
            connection.release();
        }
        return res.status(500).json({ message: 'Server error saat memproses pembayaran.' });
    }
});

// --- Start the server ---
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

// Export app for testing
module.exports = app;