const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bbgsyar.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

let cached = global._mongoClient;

if (!cached) {
    cached = global._mongoClient = { client: null, db: null };
}

async function connectToDatabase() {
    if (cached.db) {
        return cached.db;
    }

    if (!cached.client) {
        cached.client = new MongoClient(uri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
        });

        await cached.client.connect();
        console.log("✅ MongoDB connected (global cached)");
    }

    cached.db = cached.client.db("echo_serve");
    return cached.db;
}

module.exports = { connectToDatabase };
