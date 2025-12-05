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
            // <-- PERBAIKAN: Status 'pending' adalah nilai enum yang valid di tabel Pesanan
            [userId, total, 'pending']
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
        // <-- PERBAIKAN: Kembalikan status yang benar
        return res.status(201).json({ message: 'Pesanan dibuat.', id_pesanan: orderId, total_harga: total, status: 'pending' });
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

        // --- Validasi Input ---
        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ message: 'id_pesanan tidak valid.' });
        }
        if (!payMethod) {
            return res.status(400).json({ message: 'method pembayaran wajib diisi.' });
        }
        if (!Number.isFinite(amt) || amt <= 0) {
            return res.status(400).json({ message: 'amount tidak valid.' });
        }

        // <-- PERBAIKAN: Validasi method pembayaran sesuai ENUM di database
        const validMethods = ['QRIS', 'MOBILE BANKING', 'VA', 'DANA'];
        const upperMethod = payMethod.toUpperCase();
        if (!validMethods.includes(upperMethod)) {
            return res.status(400).json({ message: `Metode '${payMethod}' tidak valid. Gunakan: ${validMethods.join(', ')}` });
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

        const order = orderRows[0]; // <-- PERBAIKAN: Gunakan variabel 'order', bukan 'orderRows'

        // <-- PERBAIKAN: Status yang benar untuk dicek adalah 'pending'
        if (order.status_pesanan !== 'pending') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ message: 'Pesanan tidak bisa dibayar (Status saat ini: ' + order.status_pesanan + ').' });
        }
        if (amt < Number(order.total_harga)) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ message: 'Jumlah pembayaran kurang dari total pesanan.' });
        }

        // Simpan pembayaran
        const [payRes] = await connection.query(
            `INSERT INTO Pembayaran (id_pesanan, method, jumlah_bayar, status_bayar, bukti_bayar, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            // <-- PERBAIKAN: Gunakan status 'lunas' (sesuai ENUM Pembayaran) dan method valid
            [orderId, upperMethod, amt, 'lunas', null]
        );

        // Update pesanan
        await connection.query(
            `UPDATE Pesanan SET status_pesanan = ?, updated_at = NOW() WHERE id_pesanan = ?`,
            // <-- PERBAIKAN: Ubah status Pesanan menjadi 'diproses' (sesuai ENUM Pesanan)
            ['diproses', orderId]
        );

        await connection.commit();
        // <-- PERBAIKAN: Kembalikan status yang benar
        return res.status(201).json({ message: 'Pembayaran berhasil.', id_pembayaran: payRes.insertId, id_pesanan: orderId, status: 'diproses' });

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
        const orderId = parseInt(req.params.id, 10);
        const userId = parseInt(req.user.userId, 10);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ message: 'Order ID tidak valid.' });
        }

        const pool = await getDbPool();
        connection = await pool.getConnection();

        // 1. Ambil data pesanan utama
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
};

const getAllOrders = async (req, res) => {
    let connection = null;
    try {
        const pool = await getDbPool();
        connection = await pool.getConnection();

        // React-Admin style params
        const sort = req.query.sort ? JSON.parse(req.query.sort) : ["id_pesanan", "DESC"];
        const range = req.query.range ? JSON.parse(req.query.range) : [0, 24];
        const filter = req.query.filter ? JSON.parse(req.query.filter) : {};

        // Map RA 'id' to table column
        if (sort[0] === 'id') sort[0] = 'id_pesanan';
        // Support createdAt alias
        if (sort[0] === 'createdAt') sort[0] = 'created_at';

        const [sortField, sortOrder] = sort;
        const [start, end] = range;
        const limit = Math.max(0, (Number(end) - Number(start) + 1) || 25);
        const offset = Math.max(0, Number(start) || 0);

        const whereClauses = [];
        const params = [];

        // Text search (q) against customer name/email or order id
        if (filter.q) {
            whereClauses.push('(u.nama LIKE ? OR u.email LIKE ? OR p.id_pesanan = ?)');
            params.push(`%${filter.q}%`, `%${filter.q}%`, Number(filter.q) || 0);
        }
        // Direct filters: status_pesanan, id_pesanan, user_id
        if (filter.status || filter.status_pesanan) {
            whereClauses.push('p.status_pesanan = ?');
            params.push(filter.status || filter.status_pesanan);
        }
        if (filter.id) {
            const ids = Array.isArray(filter.id) ? filter.id : [filter.id];
            if (ids.length) {
                whereClauses.push(`p.id_pesanan IN (${ids.map(() => '?').join(',')})`);
                params.push(...ids.map(Number));
            }
        }
        if (filter.id_pesanan) {
            const ids = Array.isArray(filter.id_pesanan) ? filter.id_pesanan : [filter.id_pesanan];
            if (ids.length) {
                whereClauses.push(`p.id_pesanan IN (${ids.map(() => '?').join(',')})`);
                params.push(...ids.map(Number));
            }
        }
        // Date range filters: created_at_gte/lte or createdAt_gte/lte
        const createdGte = filter.created_at_gte || filter.createdAt_gte;
        const createdLte = filter.created_at_lte || filter.createdAt_lte;
        if (createdGte) {
            whereClauses.push('p.created_at >= ?');
            params.push(new Date(createdGte));
        }
        if (createdLte) {
            whereClauses.push('p.created_at <= ?');
            params.push(new Date(createdLte));
        }

        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Total count
        const [[{ total }]] = await connection.query(
            `SELECT COUNT(*) AS total
             FROM Pesanan p
             JOIN User u ON p.id_user = u.user_id
             ${whereSql}`,
            params
        );

        // Data page
        const [rows] = await connection.query(
            `SELECT p.id_pesanan, p.total_harga, p.status_pesanan, p.created_at,
                    u.nama AS customer_name, u.email AS customer_email
             FROM Pesanan p
             JOIN User u ON p.id_user = u.user_id
             ${whereSql}
             ORDER BY ${sortField} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Normalize id for RA and ensure ISO dates
        const data = rows.map(r => ({
            id: r.id_pesanan,
            id_pesanan: r.id_pesanan,
            total_harga: r.total_harga,
            status_pesanan: r.status_pesanan,
            created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
            customer_name: r.customer_name,
            customer_email: r.customer_email
        }));

        const safeStart = isNaN(offset) ? 0 : offset;
        const safeEnd = data.length ? safeStart + data.length - 1 : safeStart;
        res.set('Content-Range', `orders ${safeStart}-${safeEnd}/${total}`);
        res.set('Access-Control-Expose-Headers', 'Content-Range');
        return res.status(200).json(data);

    } catch (error) {
        console.error('Error fetching all order:', error);
        return res.status(500).json({ message: 'Server mengambil all order: ', error: error.message });
    }
    finally {
        if (connection) connection.release();
    }
};
// new
const updateOrderStatus = async (req, res) => {
    let connection = null;
    try {
        const orderId = parseInt(req.params.id, 10);
        const {status} = req.body || {};
        const pool = await getDbPool();
        connection = await pool.getConnection();

        const validStatus = ['pending', 'diproses', 'selesai', 'dibatalkan'];
        if (!validStatus.includes(status)) {
            return res.status(400).json({ message: `Status '${status}' tidak valid. Gunakan ${validStatus.join(', ')} ` });
        }

        const [orderRows] = await connection.query('SELECT id_pesanan from Pesanan WHERE id_pesanan = ?',[orderId]);
        if (orderRows.length === 0){
            return res.status(404).json({message: 'Pesanan tidak ditemukan/valid'});
        }

        const [result] = await connection.query('UPDATE Pesanan SET status_pesanan = ?, updated_at = NOW() WHERE id_pesanan = ? ',[status, orderId]);
        if(result.affectedRows.length === 0){
            return res.status(500).json({message: 'Gagal memperbarui status.'});
        }

        return res.status(200).json({message: `Status pesanan ${orderId} berhasil diubah menjadi ${status}.`, id_pesanan: orderId, status:status});
    } catch (error) {
        console.error('Error updating status pesanan', error);
        return res.status(500).json({ message: 'Server Order error', error });
    } finally {
        if (connection) connection.release();
    }
}

//logi ends here
module.exports = {
    addOrder,
    addPayment,
    getOrderById,
    getAllOrders,
    updateOrderStatus
};