const express = require('express');
const cors = require('cors');
require('dotenv').config();

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { getDbPool} = require('./database');


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ['http://localhost', 'http://127.0.0.1:5500', 'https://motodiv.store/api', 'https://admin.motodiv.store', 'null'], // 'null' untuk file lokal
    methods: ['GET','POST','PATCH','DELETE'],
    credentials: true // PENTING: Izinkan cookies
}));
app.use(express.json());

// --- Memuat Routes ---
(async () => {
    try {
        const dbPool = await getDbPool();
        const sessionStore = new MySQLStore({
            expiration: 86400000,
            createDatabaseTable : true,
            schema: {
                tableName: 'UserSession',
                columnNames: {
                    session_id: 'session_id',
                    expires: 'expires',
                    data: 'data'
                }
            }
        }, dbPool);

        app.use(session({
            key: 'sessionId',
            secret: process.env.SESSION_SECRET || 'my-fallback-session-secret',
            store: sessionStore,
            resave: true,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                secure: false,
                maxAge: 60 * 60 * 24
            }
        }));
        console.log(
            'Session store terhubung ke MySQL SERVER'
        );

        const ProductRoutes = require('./routes/productRoutes');
        const UserRoutes = require('./routes/usersRoutes');
        const AuthRoutes = require('./routes/authRoutes');
        const CartRoutes = require('./routes/cartRoutes');
        const OrderRoutes = require('./routes/orderRoutes');
        const LayananRoutes = require('./routes/layananRoutes');
        const UlasanRoutes = require('./routes/ulasanRoutes');

        app.use((err, req, res, next) => {
            console.log(err);
            res.status(500).json({ message: 'Terjadi Error: ', err });
        });

        app.get('/', (req, res) => {
            res.render('E-Commerce API (Session-based) is up and running!');
        });

        app.use('/api/products', ProductRoutes);
        app.use('/api/users', UserRoutes);
        app.use('/api/auth', AuthRoutes);
        app.use('/api/cart', CartRoutes);
        app.use('/api/orders', OrderRoutes);
        app.use('/api/layanan', LayananRoutes);
        app.use('/api/ulasan', UlasanRoutes);

        app.listen(PORT, () => {
            console.log(`Server started on https://localhost:${PORT}`);
        });
    } catch (err) {
        console.error({message: 'Gagal dalam starting server atau session store', err});
    }
})();