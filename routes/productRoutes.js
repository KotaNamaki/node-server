const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Pemetaan URL ke fungsi Controller
// File ini dimount di server.js dengan prefix '/api/products',
// jadi path di sini cukup '/', '/:id', dst.
router.get('/:id', productController.getProductById);
router.post('/', productController.addProduct);
router.get('/', productController.getProductAll);

module.exports = router;
