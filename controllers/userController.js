const { getDbPool } = require('../database');
const bcrypt = require("bcryptjs");
const jwt = process.env.JWT_SECRET;


// Logic starts here
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getDbPool();
        const query= 'SELECT user_id, nama, email, no_hp, role FROM user WHERE user_id = ?';
        const [rows] = await db.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(rows[0]);
    } catch (error){
        console.error(`Failed to get user_id ${req.params.id}:`, error);
        res.status(500).json({ message: 'Error fetching user.' });
    }
};

const getUserByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        const db = await getDbPool();
        const query = 'SELECT user_id, nama, email, no_hp, role FROM user WHERE email = ?';
        const [rows] = await db.query(query, [email]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User with that email not found.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error(`Failed to get email ${req.params.email}:`, error);
        res.status(500).json({ message: 'Error fetching user email.' });
    }
};



const getUser = async (req, res) => {
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
};

const updateUser = async (req, res) => {
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
    } catch (error){
        console.error('Failed to update user:', error);
        return res.status(500).json({ message: 'Server error while updating user.' });
    }
};

const userLogin = async (req, res) => {
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
            { expiresIn: '3h' } // Token expires in 1 hour
        );

        res.json({ message: 'Logged in successfully!', token });

    } catch (error) {
        console.error('Login failed:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

const userRegister = async (req, res) => {
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
};

// Logic ends here

module.exports = {
    getUserById,
    getUser,
    updateUser,
    getUserByEmail,
    userLogin,
    userRegister,


}