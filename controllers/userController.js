const { getDbPool } = require('../database');
const bcrypt = require("bcryptjs");
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
}

module.exports = {
    getUserById,
    getUser,
    updateUser,

}