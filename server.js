const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors({
    origin: ['https://motodiv.store', 'https://motodiv.store/api', 'https://admin.motodiv.store'],
    methods: ['GET','POST','PATCH','DELETE'],
    credentials: true
}));
app.use(express.json());

// --- Memuat Routes ---
const ProductRoutes = require('./routes/productRoutes');
const UserRoutes = require('./routes/usersRoutes');
const AuthRoutes = require('./routes/authRoutes');     // BARU
const CartRoutes = require('./routes/cartRoutes');       // BARU
const OrderRoutes = require('./routes/orderRoutes');

// DIUBAH: 'next' wajib ditambahkan untuk error handler
app.use((err, req, res, next) => {
    console.log(err);
    res.status(500).json({ message: 'Terjadi Error: ', err});
});

app.get('/', (req, res) => {
    res.send('E-commerce API is running!');
});

// --- Menerapkan Routes ---
app.use('/api/products', ProductRoutes);
app.use('/api/users', UserRoutes);
app.use('/api/auth', AuthRoutes);     // BARU
app.use('/api/cart', CartRoutes);     // BARU
app.use('/api/orders', OrderRoutes);  // DIUBAH (sebelumnya /api/purchase)

app.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
});