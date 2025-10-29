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

// app.get('/api/products', async (req, res) => {
//     try {
//         const db = await getDbPool(); // Lazily creates/reuses the MySQL pool via the SSH tunnel
//         // Using aliases (e.g., id_produk AS id) to match the front-end's expected JSON structure
//         const query = `
//       SELECT
//         id_produk,
//         nama,
//         deskripsi,
//         harga,
//         stok,
//         gambar
//       FROM Produk
//       WHERE stok > 0
//     `;
//         const [rows] = await db.query(query); // Execute SQL; rows is an array of products
//         res.json(rows); // Send products back as JSON
//     } catch (error) {
//         console.error('Failed to fetch products:', error);
//         res.status(500).json({ message: 'Error fetching products from database.' });
//     }
// });

/**
 * GET /api/products/:id
 * Returns a single product by its primary key (id_produk).
 */

//app.get('/api/products/:id', async (req, res) => {
//    try {
//        const { id } = req.params; // Product ID from the URL
//        const db = await getDbPool();
//        const query = `
//        SELECT
//          id_produk ,
//          nama ,
//          deskripsi ,
//          harga ,
//          stok ,
//          gambar AS image_url
//        FROM Produk
//        WHERE id_produk = ?
//      `;
//        const [rows] = await db.query(query, [id]); // Parameterized query prevents SQL injection
//        if (rows.length === 0) {
//            return res.status(404).json({ message: 'Product not found.' }); // No match for this ID
//        }
//        res.json(rows[0]); // Return the first (and only) matching product
//    } catch (error)
//    {
//        console.error(`Failed to fetch product ${req.params.id}:`, error);
//        res.status(500).json({ message: 'Error fetching product.' });
//    }
//});

//app.post('/api/products', async (req, res) => {
//   try {
//        const { nama, kategori, deskripsi, harga, stok, gambar } = req.body;
//
//        // PERBAIKAN 1: Validasi disesuaikan (hanya cek yang wajib)
//        // Jika stok dan gambar juga wajib, tambahkan '!stok || !gambar' di bawah.
//        if (!nama || !kategori || !deskripsi || !harga) {
//            return res.status(400).json({ message: 'Nama, kategori, deskripsi, dan harga wajib diisi!' });
//        }
//
//        const db = await getDbPool();
//
//        // Cek duplikat
//        const [existingProduct] = await db.query('SELECT id_produk FROM Produk WHERE nama = ?', [nama]);
//        // PERBAIKAN 2: Gunakan status 409 jika sudah ada
//        if (existingProduct.length > 0) {
//            return res.status(409).json({ message: 'Produk dengan nama ini sudah ada.' });
//        }
//
//        // PERBAIKAN 3: Perbaiki jumlah placeholder '?' menjadi 6
//        const [result] = await db.query(
//            'INSERT INTO Produk (nama, kategori, deskripsi, harga, stok, gambar) VALUES (?, ?, ?, ?, ?, ?)',
//            [nama, kategori, deskripsi, harga, stok, gambar]
//        );
//        // PERBAIKAN 4: Perbaiki syntax JSON, ganti status ke 201, dan perbaiki typo
//        res.status(201).json({
//            message: 'Produk telah dimasukkan',
//            produkID: result.insertId
//        });
//
//    } catch (error) {
//        console.error('Gagal menambah produk:', error);
//        res.status(500).json({ message: 'Server Error saat penambahan.' });
//    }
//});
/*
app.post('/api/buy/:id', async (req, res) => {
    let connection; // Mendefinisikan koneksi di luar try
    try {
        const { id } = req.params;
        const { jumlah } = req.body;
        const jumlahBeli = parseInt(jumlah, 10);

        // 1. Validasi Input
        if (!/^\d+$/.test(String(id))) {
            return res.status(400).json({ message: 'ID item tidak valid.' });
        }
        if (isNaN(jumlahBeli) || jumlahBeli <= 0) {
            return res.status(400).json({ message: 'Jumlah pembelian tidak valid.' });
        }

        // Dapatkan koneksi dari pool
        const pool = await getDbPool();
        connection = await pool.getConnection();

        // 2. Memulai Transaksi
        await connection.beginTransaction();

        // 3. Ambil data & KUNCI barisnya (FOR UPDATE)
        // Ini penting agar tidak ada proses lain yang mengubah stok ini
        const [rows] = await connection.query(
            'SELECT stok FROM Produk WHERE id_produk = ? FOR UPDATE',
            [id]
        );

        if (rows.length === 0) {
            await connection.rollback(); // Batalkan transaksi
            connection.release();
            return res.status(404).json({ message: 'Produk tidak ditemukan.' });
        }

        const stokSaatIni = rows[0].stok;

        // 4. Cek ketersediaan stok
        if (stokSaatIni < jumlahBeli) {
            await connection.rollback(); // Batalkan transaksi
            connection.release();
            return res.status(400).json({ message: 'Stok tidak mencukupi.' });
        }

        // 5. Hitung dan update stok baru
        const stokBaru = stokSaatIni - jumlahBeli;
        await connection.query(
            'UPDATE Produk SET stok = ? WHERE id_produk = ?',
            [stokBaru, id]
        );

        // 6. Simpan perubahan (Commit)
        await connection.commit();

        // 7. Ambil data terbaru (karena MySQL tidak punya 'RETURNING')
        const [updatedProduct] = await connection.query(
            'SELECT * FROM Produk WHERE id_produk = ?',
            [id]
        );

        connection.release(); // Kembalikan koneksi ke pool
        res.status(200).json({
            message: 'Pembelian berhasil, stok diperbarui.',
            data: updatedProduct[0]
        });

    } catch (error) {
        console.error(error);
        // Jika terjadi error, batalkan semua perubahan (rollback)
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const db = await getDbPool();
        const query = `
        SELECT user_id, nama, email, no_hp, role
        FROM user`;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (error) {
        console.error(`Failed to fetch users`, error);
        res.status(500).json({ message: 'Error fetching users.' });
    }
});

// --- Authentication Routes (Adjusted for 'user' table) ---
/**
 * POST /api/auth/register
 * Create a new user with a hashed password and default role "customer".
 * Expected body: { nama, email, password, no_hp }
 */
/*
app.post('/api/auth/register', async (req, res) => {
    try {
        // Now expecting 'nama' and 'no_hp' from the request body
        const { nama, email, password, no_hp } = req.body;
        if (!email || !password || !nama || !no_hp) {
            return res.status(400).json({ message: 'Nama, email, password, dan no_hp wajib diisi.' });
        }

        const db = await getDbPool();
        // Check if user already exists
        const [existingUsers] = await db.query('SELECT user_id FROM user WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Akun dengan email ini sudah ada.' });
        }

        // Hash the password with a per-user salt before storing in the database
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Insert the new user record
        const [result] = await db.query(
            'INSERT INTO user (nama, email, password, no_hp, role) VALUES (?, ?, ?, ?, ?)',
            [nama, email, passwordHash, no_hp, 'customer'] // Default role to 'customer'
        );

        res.status(201).json({ message: 'User registered successfully!', userId: result.insertId });

    } catch (error) {
        console.error('Registration failed:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});
//
/**
 * POST /api/auth/login
 * Authenticates a user by comparing a plaintext password with the stored hash.
 * On success, returns a short-lived JWT for subsequent authenticated requests.
 */
//app.post('/api/auth/login', async (req, res) => {
//    try {
//        const { email, password } = req.body; // Credentials from client
//        if (!email || !password) {
//            return res.status(400).json({ message: 'Email and password are required.' });
//        }
//
//        const db = await getDbPool();
//        // Fetching from 'user' table and selecting the hashed password column
//        const [users] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
//        if (users.length === 0) {
//            return res.status(401).json({ message: 'Invalid credentials.' });
//        }
//
//        const user = users[0];
//        // Comparing plaintext with the hashed password stored in DB
//        const isMatch = await bcrypt.compare(password, user.password);
//        if (!isMatch) {
//            return res.status(401).json({ message: 'Invalid credentials.' });
//        }
//
//        // Create JWT signed with secret; includes basic claims for authorization
//        const token = jwt.sign(
//            { userId: user.user_id, email: user.email, role: user.role },
//            JWT_SECRET,
//            { expiresIn: '3h' } // Token expires in 1 hour
//        );
//
//        res.json({ message: 'Logged in successfully!', token });
//
//    } catch (error) {
//        console.error('Login failed:', error);
//        res.status(500).json({ message: 'Server error during login.' });
//    }
//});


//app.patch('/api/users/:id', async (req, res) => {
//    try {
//        const { id } = req.params;
//        // Basic validation for numeric ID
//        if (!/^\d+$/.test(String(id))) {
//            return res.status(400).json({ message: 'Invalid user id.' });
//        }
//
//        const { nama, email, no_hp, password } = req.body || {};
//
//        // Build dynamic update set based on provided fields
//        const fields = [];
//        const values = [];
//
//        if (nama !== undefined) {
//            fields.push('nama = ?');
//            values.push(nama);
//        }
//        if (email !== undefined) {
//            fields.push('email = ?');
//            values.push(email);
//        }
//        if (no_hp !== undefined) {
//            fields.push('no_hp = ?');
//            values.push(no_hp);
//        }
//        if (password !== undefined) {
//            // Hash the new password if provided
//            const salt = await bcrypt.genSalt(10);
//            const hash = await bcrypt.hash(password, salt);
//            fields.push('password = ?');
//            values.push(hash);
//        }
//
//        if (fields.length === 0) {
//            return res.status(400).json({ message: 'No valid fields to update. Allowed: nama, email, no_hp, password.' });
//        }
//
//        const db = await getDbPool();
//
//        // Ensure user exists
//        const [existing] = await db.query('SELECT user_id FROM user WHERE user_id = ?', [id]);
//        if (existing.length === 0) {
//            return res.status(404).json({ message: 'User not found.' });
//        }
//
//        // If email is being updated, ensure it is not taken by another user
//        if (email !== undefined) {
//            const [emailTaken] = await db.query('SELECT user_id FROM user WHERE email = ? AND user_id <> ?', [email, id]);
//            if (emailTaken.length > 0) {
//                return res.status(409).json({ message: 'Email is already in use by another account.' });
//            }
//        }
//
//        const sql = `UPDATE user SET ${fields.join(', ')} WHERE user_id = ?`;
//        await db.query(sql, [...values, id]);
//
//        // Return the updated user (omit password)
//        const [rows] = await db.query('SELECT user_id, nama, email, no_hp, role FROM user WHERE user_id = ?', [id]);
//        return res.json({ message: 'User updated successfully!', user: rows[0] });
//    } catch (error) {
//        console.error('Failed to update user:', error);
//        return res.status(500).json({ message: 'Server error while updating user.' });
//    }
//});
//
// --- Cart, Order, Payment Routes ---

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
app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${PORT}`);
});