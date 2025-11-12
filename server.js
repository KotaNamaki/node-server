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
require('dotenv').config(); // Loads variables from .env into process.env

const app = express(); // Initialize Express application
const PORT = process.env.PORT || 3000; // HTTP port; default to 3000 when not set

// --- Middleware ---
app.use(cors({
    origin: ['https://motodiv.store', 'https://motodiv.store/api', 'https://admin.motodiv.store'],
    methods: ['GET','POST','PATCH','DELETE'],
    credentials: true
})); // Allow calls from other origins (e.g., React app on a different port)
app.use(express.json()); // Parse JSON request bodies into req.body

const ProductRoutes = require('./routes/productRoutes');
const UserRoutes = require('./routes/usersRoutes');
const OrderRoutes = require('./routes/orderRoutes')

app.use((err, req, res) => {
    console.log(err);
    res.status(500).json({ message: 'Terjadi Error: ', err});
});

app.get('/', (req, res) => {
    res.send('E-commerce API is running!');
});

app.use('/api/products', ProductRoutes);
app.use('/api/users', UserRoutes);
app.use('/api/purchase', OrderRoutes);

app.listen(PORT, () => {
   console.log(`Server running on port http://localhost:${PORT}`);
});