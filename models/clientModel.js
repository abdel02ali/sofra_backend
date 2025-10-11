
const { db } = require("../config/firebase");
const collection = db.collection("clients");

exports.createClient = async (data) => {
  const docRef = await collection.add({ ...data, createdAt: new Date() });
  return { id: docRef.id };
};

exports.getAllClients = async () => {
  const snapshot = await collection.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

exports.updateClient = async (id, data) => {
  await collection.doc(id).update(data);
  return { success: true };
};

exports.deleteClient = async (id) => {
  await collection.doc(id).delete();
  return { success: true };
};
