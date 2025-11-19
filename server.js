const express = require('express');
const cors = require('cors');
require('dotenv').config();

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { getDbPool} = require('./database');


const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["self"],
            scriptSrc: ["self", "unsafe-inline"],
            imgSrc: ["self", "data:", "https:"],
            objectSrc: ["none"],
            upgradeInsecureRequest: [],
        },
    })
);

app.use((req,res,next) => {
    const host = req.headers.host;
    if (host && host.includes('169.254.169.254')) {
        return res.status(403).send('Forbidden');
    }
    next();
});

app.use(cors({
    origin: ['http://localhost', 'http://127.0.0.1:5500', 'https://motodiv.store', 'https://admin.motodiv.store', 'null', 'https://api.motodiv.store'], // 'null' untuk file lokal
    methods: ['GET','POST','PATCH','DELETE'],
    credentials: true // PENTING: Izinkan cookies
}));
//whoops
app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(hpp());

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 100, // Maksimal 100 request per IP per 15 menit
    message: 'Terlalu banyak request dari IP ini, silakan coba lagi nanti.',
    standardHeaders: true,
    legacyHeaders: false
});

app.use(generalLimiter);

app.use(session({
    key: 'sessionId',
    secret: process.env.SESSION_SECRET || 'rahasia',
    store: sessionStore,
    resave: false, // Ubah ke false untuk efisiensi (recommended)
    saveUninitialized: false,
    cookie: {
        httpOnly: true, // PENTING: Agar JS di browser tidak bisa baca cookie (Anti-XSS)

        // Ubah logika ini: Jika production (motodiv.store), wajib true. Localhost boleh false.
        secure: process.env.NODE_ENV === 'production',

        // PENTING: Mencegah CSRF (Cross-Site Request Forgery)
        // 'Lax' berarti cookie hanya dikirim saat user navigasi ke situs Anda, bukan dari iframe situs lain.
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',

        maxAge: 1000 * 60 * 60 * 24 // 1 Hari
    }
}));

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
            res.json('E-Commerce API (Session-based) is up and running!');
        });

        app.use('/products', ProductRoutes);
        app.use('/users', UserRoutes);
        app.use('/auth', AuthRoutes);
        app.use('/cart', CartRoutes);
        app.use('/orders', OrderRoutes);
        app.use('/layanan', LayananRoutes);
        app.use('/ulasan', UlasanRoutes);

        app.listen(PORT, () => {
            console.log(`Server started on https://localhost:${PORT}`);
        });
    } catch (err) {
        console.error({message: 'Gagal dalam starting server atau session store', err});
    }
})();