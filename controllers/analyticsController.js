const { getDbPool } = require('../database');

// GET /analytics/orders/counters?lastDays=7
const getOrderCounters = async (req, res) => {
    let connection;
    try {
        const lastDays = Math.max(1, Math.min(365, parseInt(req.query.lastDays || '7', 10) || 7));

        const pool = await getDbPool();
        connection = await pool.getConnection();

        // Last N days orders
        const [[{ last7 }]] = await connection.query(
            `SELECT COUNT(*) AS last7
             FROM Pesanan
             WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)`,
            [lastDays]
        );

        // Pending orders
        const [[{ pending }]] = await connection.query(
            `SELECT COUNT(*) AS pending
             FROM Pesanan
             WHERE status_pesanan = 'pending'`
        );

        return res.json({ last7DaysOrders: last7, pendingOrders: pending, windowDays: lastDays });
    } catch (e) {
        console.error('Analytics counters error:', e);
        return res.status(500).json({ message: 'Server analytics error', error: e.message });
    } finally {
        if (connection) connection.release();
    }
};

// GET /analytics/sales/by-month?from=YYYY-MM-DD&to=YYYY-MM-DD
const getSalesByMonth = async (req, res) => {
    let connection;
    try {
        const { from, to, groupBy } = req.query;

        if (!from || !to) {
            return res.status(400).json({ message: 'Parameter from dan to wajib diisi (YYYY-MM-DD).' });
        }
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return res.status(400).json({ message: 'Format tanggal tidak valid. Gunakan YYYY-MM-DD.' });
        }
        if (fromDate > toDate) {
            return res.status(400).json({ message: 'Range tanggal tidak valid: from > to.' });
        }

        if (groupBy && groupBy !== 'none') {
            // Not yet supported because line item type grouping is not defined consistently
            return res.status(400).json({ message: 'groupBy belum didukung pada server ini.' });
        }

        const pool = await getDbPool();
        connection = await pool.getConnection();

        // Group by year-month (UTC)
        const [rows] = await connection.query(
            `SELECT DATE_FORMAT(CONVERT_TZ(created_at, @@session.time_zone, '+00:00'), '%Y-%m') AS period,
                    SUM(total_harga) AS total
             FROM Pesanan
             WHERE created_at BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
             GROUP BY period
             ORDER BY period ASC`,
            [fromDate, toDate]
        );

        const buckets = rows.map(r => ({ period: r.period, total: Number(r.total) || 0 }));
        return res.json({ buckets, from, to });
    } catch (e) {
        console.error('Analytics by-month error:', e);
        return res.status(500).json({ message: 'Server analytics error', error: e.message });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { getOrderCounters, getSalesByMonth };
