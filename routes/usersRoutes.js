const express = require('express');
const userController = require('../controllers/userController');
const router = express.Router();

// Pemetaan URL ke ke fungsi router
router.get('/:id', userController.getUserById);
router.get('/', userController.getUser);
router.patch('/:id', userController.updateUser);
router.get('/:email', userController.getUserByEmail);

module.exports = router;