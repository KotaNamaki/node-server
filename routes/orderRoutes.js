// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authReq } = require('../middleware/authMiddleWare');

// Semua route order memerlukan login
router.use(authReq);

router.post('/', orderController.addOrder); // Checkout
router.get('/:id', orderController.getOrderById);
router.post('/:id/payments', orderController.addPayment); // <-- URL Diubah

module.exports = router;