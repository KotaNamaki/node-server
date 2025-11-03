const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

router.post('/cart', purchaseController.addToCart);
router.post('/order', purchaseController.addOrder);
router.post('/payment', purchaseController.addPayment);

module.exports = router;

