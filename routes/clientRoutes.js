// routes/clientRoutes.js
const express = require("express");
const router = express.Router();
const clientController = require("../controllers/clientCon");

// ✅ Create a new client
router.post("/", async (req, res) => {
  try {
    const client = await clientController.createClient(req.body);
    res.status(201).json(client);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Get all clients
router.get("/", async (req, res) => {
  try {
    const clients = await clientController.getAllClients();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get a single client by ID
router.get("/:id", async (req, res) => {
  try {
    const client = await clientController.getClientById(req.params.id);
    res.json(client);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ✅ Update client
router.put("/:id", async (req, res) => {
  try {
    const result = await clientController.updateClient(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Delete client
router.delete("/:id", async (req, res) => {
  try {
    const result = await clientController.deleteClient(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
