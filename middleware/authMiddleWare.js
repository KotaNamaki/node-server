const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const authReq = (req, res, next) => {
    if (!JWT_SECRET) {
        // Konfigurasi server bermasalah; informasikan dengan aman
        return res.status(500).json({ message: 'Konfigurasi server tidak lengkap (JWT_SECRET).' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: 'Token tidak ada atau format Authorization salah (harap gunakan Bearer token).' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // berisi userId/dll sesuai payload token
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token tidak valid atau kadaluarsa.' });
    }
};

const adminReq = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Otentikasi diperlukan' });
    }
    if (req.user.role !== 'admin') {
        return res.status(401).json({ message: 'Akses ditolak, fiture ini hanya bisa digunakan oleh admin' });
    }
    next();
};


module.exports = { authReq, adminReq };