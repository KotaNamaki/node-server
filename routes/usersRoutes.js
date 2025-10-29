const express = require('express');
const userController = require('../controllers/userController');
const router = express.Router();

// Pemetaan URL ke ke fungsi router
router.get('/:id', userController.getUserById);
router.get('/', userController.getUser);
router.patch('/update/:id', userController.updateUser);
router.get('/:email', userController.getUserByEmail);
router.post('/auth/login', userController.userLogin)
router.post('/auth/register', userController.userRegister)

module.exports = router;