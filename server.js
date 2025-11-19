const express = require('express');
const cors = require('cors');
require('dotenv').config();

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { getDbPool } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Trust Proxy (WAJIB agar secure cookies jalan di NGINX/Cloudflare/Production)
app.set('trust proxy', 1);

// 2. Security Headers (Helmet)
app.use(helmet());
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            // PERBAIKAN: Tambah kutip tunggal pada unsafe-inline
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            // PERBAIKAN: Tambah kutip tunggal pada none
            objectSrc: ["'none'"],
            // PERBAIKAN: Tambah huruf 's'
            upgradeInsecureRequests: [],
        },
    })
);

// 3. Cloud Metadata Protection
app.use((req, res, next) => {
    const host = req.headers.host;
    if (host && host.includes('169.254.169.254')) {
        return res.status(403).send('Forbidden');
    }
    next();
});

// 4. CORS
app.use(cors({
    origin: ['http://localhost', 'http://127.0.0.1:5500', 'https://motodiv.store', 'https://admin.motodiv.store', 'null', 'https://api.motodiv.store'],
    methods: ['GET','POST','PATCH','DELETE'],
    credentials: true
}));

// 5. Body Parser & HPP
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(hpp(undefined));

// 6. Rate Limiter
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Terlalu banyak request dari IP ini, silakan coba lagi nanti.',
    standardHeaders: true,
    legacyHeaders: false
});
app.use(generalLimiter);

// --- Inisialisasi Database & Session (Async) ---
(async () => {
    try {
        const dbPool = await getDbPool();

        // Setup Session Store
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

        console.log('Session store terhubung ke MySQL SERVER');

        // 7. Session Middleware (HANYA SATU KALI DISINI)
        app.use(session({
            key: 'sessionId',
            secret: process.env.SESSION_SECRET || 'rahasia_default_jangan_dipakai_di_prod',
            store: sessionStore,
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                // Secure hanya true jika di production (https)
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
                maxAge: 1000 * 60 * 60 * 24 // 1 Hari
            }
        }));

        // 8. Routes
        const ProductRoutes = require('./routes/productRoutes');
        const UserRoutes = require('./routes/usersRoutes');
        const AuthRoutes = require('./routes/authRoutes');
        const CartRoutes = require('./routes/cartRoutes');
        const OrderRoutes = require('./routes/orderRoutes');
        const LayananRoutes = require('./routes/layananRoutes');
        const UlasanRoutes = require('./routes/ulasanRoutes');

        app.get('/', (req, res) => {
            res.json('E-Commerce API (Session-based) is up and running!');
        });

        app.use('/products', ProductRoutes);
        app.use('/users', UserRoutes);
        app.use('/auth', AuthRoutes);
        app.use('/cart', CartRoutes);
        app.use('/orders', OrderRoutes);
        app.use('/layanan', LayananRoutes);
        app.use('/ulasan', UlasanRoutes);

        // 9. Error Handling Global
        app.use((err, req, res, next) => {
            console.error(err); // Log error di console server
            // Jangan tampilkan detail error di production
            return res.status(500).send({
                message: 'Internal Server Error: ', err
            })
        });

        app.listen(PORT, () => {
            console.log(`Server started on port http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error({message: 'Gagal dalam starting server atau session store', err});
    }
})();