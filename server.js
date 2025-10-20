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
const bcrypt = require('bcryptjs'); // Library for hashing and verifying passwords
const jwt = require('jsonwebtoken'); // Library for creating/verifying JSON Web Tokens
const { getDbPool } = require('./database'); // Pooled DB connector wrapped over an SSH tunnel
require('dotenv').config(); // Loads variables from .env into process.env

const app = express(); // Initialize Express application
const PORT = process.env.PORT || 3000; // HTTP port; default to 3000 when not set
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-super-secret-key'; // Fallback secret for development

// --- Middleware ---
app.use(cors()); // Allow calls from other origins (e.g., React app on a different port)
app.use(express.json()); // Parse JSON request bodies into req.body

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
app.get('/api/products', async (req, res) => {
    try {
        const db = await getDbPool(); // Lazily creates/reuses the MySQL pool via the SSH tunnel
        // Using aliases (e.g., id_produk AS id) to match the front-end's expected JSON structure
        const query = `
      SELECT 
        id_produk AS id, 
        nama AS name, 
        deskripsi AS description, 
        harga AS price, 
        stok AS stock_quantity, 
        gambar AS image_url 
      FROM Produk 
      WHERE stok > 0
    `;
        const [rows] = await db.query(query); // Execute SQL; rows is an array of products
        res.json(rows); // Send products back as JSON
    } catch (error) {
        console.error('Failed to fetch products:', error);
        res.status(500).json({ message: 'Error fetching products from database.' });
    }
});

/**
 * GET /api/products/:id
 * Returns a single product by its primary key (id_produk).
 */
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params; // Product ID from the URL
        const db = await getDbPool();
        const query = `
        SELECT 
          id_produk AS id, 
          nama AS name, 
          deskripsi AS description, 
          harga AS price, 
          stok AS stock_quantity, 
          gambar AS image_url 
        FROM Produk 
        WHERE id_produk = ?
      `;
        const [rows] = await db.query(query, [id]); // Parameterized query prevents SQL injection
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Product not found.' }); // No match for this ID
        }
        res.json(rows[0]); // Return the first (and only) matching product
    } catch (error)
    {
        console.error(`Failed to fetch product ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error fetching product.' });
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

/**
 * POST /api/auth/login
 * Authenticates a user by comparing a plaintext password with the stored hash.
 * On success, returns a short-lived JWT for subsequent authenticated requests.
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body; // Credentials from client
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const db = await getDbPool();
        // Fetching from 'user' table and selecting the hashed password column
        const [users] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const user = users[0];
        // Comparing plaintext with the hashed password stored in DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Create JWT signed with secret; includes basic claims for authorization
        const token = jwt.sign(
            { userId: user.user_id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        res.json({ message: 'Logged in successfully!', token });

    } catch (error) {
        console.error('Login failed:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});


app.patch('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Basic validation for numeric ID
        if (!/^\d+$/.test(String(id))) {
            return res.status(400).json({ message: 'Invalid user id.' });
        }

        const { nama, email, no_hp, password } = req.body || {};

        // Build dynamic update set based on provided fields
        const fields = [];
        const values = [];

        if (nama !== undefined) {
            fields.push('nama = ?');
            values.push(nama);
        }
        if (email !== undefined) {
            fields.push('email = ?');
            values.push(email);
        }
        if (no_hp !== undefined) {
            fields.push('no_hp = ?');
            values.push(no_hp);
        }
        if (password !== undefined) {
            // Hash the new password if provided
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            fields.push('password = ?');
            values.push(hash);
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: 'No valid fields to update. Allowed: nama, email, no_hp, password.' });
        }

        const db = await getDbPool();

        // Ensure user exists
        const [existing] = await db.query('SELECT user_id FROM user WHERE user_id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // If email is being updated, ensure it is not taken by another user
        if (email !== undefined) {
            const [emailTaken] = await db.query('SELECT user_id FROM user WHERE email = ? AND user_id <> ?', [email, id]);
            if (emailTaken.length > 0) {
                return res.status(409).json({ message: 'Email is already in use by another account.' });
            }
        }

        const sql = `UPDATE user SET ${fields.join(', ')} WHERE user_id = ?`;
        await db.query(sql, [...values, id]);

        // Return the updated user (omit password)
        const [rows] = await db.query('SELECT user_id, nama, email, no_hp, role FROM user WHERE user_id = ?', [id]);
        return res.json({ message: 'User updated successfully!', user: rows[0] });
    } catch (error) {
        console.error('Failed to update user:', error);
        return res.status(500).json({ message: 'Server error while updating user.' });
    }
});

// --- Start the server ---
app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${PORT}`);
});

