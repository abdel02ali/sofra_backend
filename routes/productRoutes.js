const express = require("express");
const router = express.Router();
const ProductsController = require("../controllers/productCon");

// CRUD routes
router.post("/", ProductsController.addProduct);
router.get("/", ProductsController.getProducts);
router.get("/:id", ProductsController.getProduct);
router.put("/:id", ProductsController.updateProduct);
router.delete("/:id", ProductsController.deleteProduct);
router.post('/add-quantities', ProductsController.addProductQuantities);
router.post('/remove-quantities', ProductsController.removeProductQuantities);

module.exports = router;
