const {getDbPool} = require("../database");

// Logic Starts here


const addOrder = async (req, res) => {
    let connection = null;
    try {
        const userId = parseInt(req.user.userId, 10);
        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({ message: 'user_id tidak valid.' });
        }

        const pool = await getDbPool();
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Pastikan user ada
        const [userRows] = await connection.query('SELECT user_id FROM User WHERE user_id = ? FOR UPDATE', [userId]);
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
            if (item.stok < item.jumlah) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ message: `Stok tidak cukup untuk produk ${item.id_produk}.` });
            }
        }

        // Buat pesanan
        const total = cartItems.reduce((sum, it) => sum + (it.harga * it.jumlah), 0);
        const [orderRes] = await connection.query(
            'INSERT INTO Pesanan (id_user, total_harga, status_pesanan, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            [userId, total, 'menunggu_pembayaran']
        );
        const orderId = orderRes.insertId;

        // Insert item pesanan dan update stok produk
        for (const item of cartItems) {
            await connection.query(
                'INSERT INTO PesananItem (id_pesanan, id_produk, jumlah, harga_satuan, subtotal) VALUES (?, ?, ?, ?, ?)',
                [orderId, item.id_produk, item.jumlah, item.harga, item.harga * item.jumlah]
            );
            await connection.query(
                'UPDATE Produk SET stok = stok - ? WHERE id_produk = ?',
                [item.jumlah, item.id_produk]
            );
        }

        // Kosongkan keranjang
        await connection.query('DELETE FROM Keranjang WHERE id_user = ?', [userId]);

        await connection.commit();
        return res.status(201).json({ message: 'Pesanan dibuat.', id_pesanan: orderId, total_harga: total, status: 'menunggu_pembayaran' });
    } catch (error) {
        console.error('Gagal membuat pesanan:', error);
        return res.status(500).json({ message: 'Server error saat membuat pesanan.' });
    } finally {
        if (connection) connection.release();
    }
};

const addPayment = async (req, res) => {
    let connection = null;
    try {
        const {method, amount} = req.body || {};
        const orderId = parseInt(req.params.id, 10);
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
        if (order.status_pesanan !== 'menunggu_pembayaran') {
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
            `INSERT INTO Pembayaran (id_pesanan, method, jumlah_bayar, status_bayar, bukti_bayar, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [orderId, payMethod, amt, 'berhasil', null] // or a real bukti_bayar string/URL if provided
        );

        // Update pesanan
        await connection.query(
            `UPDATE Pesanan SET status_pesanan = 'dibayar', updated_at = NOW() WHERE id_pesanan = ?`,
            [orderId]
        );

        await connection.commit();
        return res.status(201).json({ message: 'Pembayaran berhasil.', id_pembayaran: payRes.insertId, id_pesanan: orderId, status: 'dibayar' });

    } catch (error) {
        console.error('Gagal memproses pembayaran:', error);
        return res.status(500).json({ message: 'Server error saat memproses pembayaran.' });
    }
    finally {
        if (connection) connection.release();
    }
};

const getOrderById = async (req, res) => {
    let connection = null;
    try{
        // Sesuai route map: /api/orders/:id
        const orderId = parseInt(req.params.id, 10);
        const userId = parseInt(req.user.userId, 10); // Dari auth middleware

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ message: 'Order ID tidak valid.' });
        }

        const pool = await getDbPool();
        connection = await pool.getConnection();

        // 1. Ambil data pesanan utama
        // Memastikan user hanya bisa melihat order miliknya
        const [orderRows] = await connection.query(
            'SELECT * FROM Pesanan WHERE id_pesanan = ? AND id_user = ?',
            [orderId, userId]
        );

        if (orderRows.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'Pesanan tidak ditemukan atau bukan milik Anda.' });
        }

        const orderData = orderRows[0];

        // 2. Ambil item-item pesanan
        const [itemRows] = await connection.query(
            `SELECT 
                pi.id_produk, 
                pi.jumlah, 
                pi.harga_satuan, 
                pi.subtotal,
                p.nama,
                p.gambar
            FROM PesananItem pi
            JOIN Produk p ON pi.id_produk = p.id_produk
            WHERE pi.id_pesanan = ?`,
            [orderId]
        );

        // 3. Ambil data pembayaran (jika ada)
        const [paymentRows] = await connection.query(
            'SELECT * FROM Pembayaran WHERE id_pesanan = ?',
            [orderId]
        );

        connection.release();

        // Gabungkan semua data
        const result = {
            ...orderData,
            items: itemRows,
            pembayaran: paymentRows.length > 0 ? paymentRows[0] : null
        };

        return res.status(200).json(result);

    }catch(error){
        console.error('Error getting Order:', error);
        return res.status(500).json({ message: 'Server Order error', error: error.message });
    } finally {
        if (connection) connection.release();
    }
}
//logi ends here
module.exports = {
    addOrder,
    addPayment,
    getOrderById,
};