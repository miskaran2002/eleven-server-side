// db.js
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bbgsyar.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

let db;

async function connectToDatabase() {
    if (!db) {
        await client.connect();
        db = client.db('echo_serve');
        console.log('✅ MongoDB connected (cached)');
    }
    return db;
}

module.exports = { connectToDatabase, client };
