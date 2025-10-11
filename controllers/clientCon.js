// controllers/clientController.js
const { db } = require("../config/firebase");
const clientsCollection = db.collection("clients");
const counterCollection = db.collection("counters");

/**
 * Generate sequential client ID (cli-001, cli-002, etc.)
 */
const generateClientId = async () => {
  try {
    console.log('🔄 Generating client ID...');
    
    // Count existing clients to determine next ID
    const snapshot = await clientsCollection.get();
    const existingCount = snapshot.size;
    const nextCount = existingCount + 1;
    
    // Format with leading zeros
    const formattedNumber = nextCount.toString().padStart(3, '0');
    const clientId = `cli-${formattedNumber}`;
    
    console.log(`✅ Generated client ID: ${clientId} (from ${existingCount} existing clients)`);
    return clientId;
    
  } catch (error) {
    console.error('❌ Error generating client ID:', error);
    // Fallback using timestamp
    const timestamp = Date.now().toString(36);
    return `cli-${timestamp}`;
  }
};

/**
 * Create a new client
 */
exports.createClient = async (data) => {
  try {
    console.log('🔄 Creating client with data:', data);
    
    // Validate required fields
    if (!data.name) {
      throw new Error("Client name is required");
    }

    // Generate client ID
    const clientId = await generateClientId();

    // Create client with generated ID
    await clientsCollection.doc(clientId).set({
      name: data.name,
      phone: data.phone || "",
      location: data.location || "",
      createdAt: new Date(),
    });

    console.log('✅ Client created successfully with ID:', clientId);
    return { id: clientId };
    
  } catch (error) {
    console.error('❌ Error in createClient:', error);
    throw new Error(`Failed to create client: ${error.message}`);
  }
};

/**
 * Get all clients
 */
exports.getAllClients = async () => {
  try {
    console.log('🔄 Fetching all clients...');
    
    const snapshot = await clientsCollection.orderBy("createdAt", "desc").get();
    const clients = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    
    console.log(`✅ Retrieved ${clients.length} clients`);
    return clients;
    
  } catch (error) {
    console.error('❌ Error in getAllClients:', error);
    throw new Error(`Failed to fetch clients: ${error.message}`);
  }
};

/**
 * Get a single client by ID
 */
exports.getClientById = async (id) => {
  try {
    console.log(`🔄 Fetching client with ID: ${id}`);
    
    const doc = await clientsCollection.doc(id).get();
    if (!doc.exists) {
      throw new Error("Client not found");
    }
    
    const client = { id: doc.id, ...doc.data() };
    console.log('✅ Client found:', client.name);
    return client;
    
  } catch (error) {
    console.error('❌ Error in getClientById:', error);
    throw new Error(`Failed to fetch client: ${error.message}`);
  }
};

/**
 * Update a client
 */
exports.updateClient = async (id, data) => {
  try {
    console.log(`🔄 Updating client ${id} with data:`, data);
    
    const doc = await clientsCollection.doc(id).get();
    if (!doc.exists) {
      throw new Error("Client not found");
    }

    await clientsCollection.doc(id).update({
      ...data,
      updatedAt: new Date(),
    });

    console.log('✅ Client updated successfully');
    return { success: true, message: "Client updated successfully" };
    
  } catch (error) {
    console.error('❌ Error in updateClient:', error);
    throw new Error(`Failed to update client: ${error.message}`);
  }
};

/**
 * Delete a client
 */
exports.deleteClient = async (id) => {
  try {
    console.log(`🔄 Deleting client ${id}`);
    
    const doc = await clientsCollection.doc(id).get();
    if (!doc.exists) {
      throw new Error("Client not found");
    }

    await clientsCollection.doc(id).delete();

    console.log('✅ Client deleted successfully');
    return { success: true, message: "Client deleted successfully" };
    
  } catch (error) {
    console.error('❌ Error in deleteClient:', error);
    throw new Error(`Failed to delete client: ${error.message}`);
  }
};