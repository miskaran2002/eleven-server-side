const express = require('express');
const cors = require('cors');
const { ObjectId } = require('mongodb');
require('dotenv').config();

const admin = require('firebase-admin');
const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
  };

const { connectToDatabase, client } = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// firebase admin initialization
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// middleware to verify token
const verifyFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        next();
    } catch (error) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
};

async function run() {
    try {
        const db = await connectToDatabase();
        const servicesCollection = db.collection('services');
        const reviewsCollection = db.collection('reviews');
        const usersCollection = db.collection('users');

        // ────── User Routes ─────────────────────

        app.post('/users', async (req, res) => {
            const user = req.body;
            const existingUser = await usersCollection.findOne({ email: user.email });
            if (existingUser) return res.send({ message: 'User already exists' });

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.get('/users', async (req, res) => {
            const email = req.query.email;
            if (!email) return res.status(400).json({ error: 'Email query required' });

            const user = await usersCollection.findOne({ email });
            res.send({ exists: !!user });
        });

        app.get('/platform-stats', async (req, res) => {
            try {
                const userCount = await usersCollection.estimatedDocumentCount();
                const serviceCount = await servicesCollection.estimatedDocumentCount();
                const reviewCount = await reviewsCollection.estimatedDocumentCount();
                res.send({ users: userCount, services: serviceCount, reviews: reviewCount });
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch stats' });
            }
        });

        // ────── Services Routes ─────────────────────

        app.get('/allServices', async (req, res) => {
            try {
                const result = await servicesCollection.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch services' });
            }
        });

        app.get('/sixServices', async (req, res) => {
            try {
                const email = req.query.email;
                const limit = req.query.limit ? parseInt(req.query.limit) : null;
                const query = email ? { userEmail: email } : {};

                let cursor = servicesCollection.find(query);
                if (limit) cursor = cursor.limit(limit);

                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch services' });
            }
        });

        app.get('/services', verifyFirebaseToken, async (req, res) => {
            try {
                const email = req.query.email;
                if (email !== req.decoded.email) return res.status(403).send({ message: 'forbidden access' });

                const limit = req.query.limit ? parseInt(req.query.limit) : null;
                const query = email ? { userEmail: email } : {};

                let cursor = servicesCollection.find(query);
                if (limit) cursor = cursor.limit(limit);

                const result = await cursor.toArray();
                res.send(result);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch services' });
            }
        });

        app.post('/services', async (req, res) => {
            const newService = req.body;
            const result = await servicesCollection.insertOne(newService);
            res.send(result);
        });

        app.delete('/services/:id', async (req, res) => {
            const id = req.params.id;
            const result = await servicesCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const result = await servicesCollection.findOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        app.patch('/services/:id', async (req, res) => {
            const id = req.params.id;
            const updated = req.body;
            const result = await servicesCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        serviceImage: updated.serviceImage,
                        serviceTitle: updated.serviceTitle,
                        companyName: updated.companyName,
                        website: updated.website,
                        description: updated.description,
                        category: updated.category,
                        price: updated.price,
                    },
                }
            );
            res.send(result);
        });

        // ────── Reviews Routes ─────────────────────

        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const service = await servicesCollection.findOne({ _id: new ObjectId(review.serviceId) });
            const completeReview = {
                ...review,
                serviceTitle: service?.serviceTitle || '',
                serviceImage: service?.serviceImage || '',
                date: new Date().toISOString(),
            };
            const result = await reviewsCollection.insertOne(completeReview);
            res.send(result);
        });

        app.patch('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const updated = req.body;
            const result = await reviewsCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        text: updated.text,
                        rating: updated.rating,
                        date: new Date().toISOString(),
                    },
                }
            );
            res.send(result);
        });

        app.get('/reviews', async (req, res) => {
            const { userEmail, serviceId } = req.query;
            const query = {};
            if (userEmail) query.userEmail = userEmail;
            if (serviceId) query.serviceId = serviceId;

            try {
                const result = await reviewsCollection.find(query).sort({ date: -1 }).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Server error' });
            }
        });

        app.get('/reviews', verifyFirebaseToken, async (req, res) => {
            const { userEmail, serviceId } = req.query;
            if (userEmail && userEmail !== req.decoded.email) return res.status(403).send({ message: 'forbidden access' });

            const query = {};
            if (userEmail) query.userEmail = userEmail;
            if (serviceId) query.serviceId = serviceId;

            try {
                const result = await reviewsCollection.find(query).sort({ date: -1 }).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Server error' });
            }
        });

        app.delete('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const result = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        console.log('🚀 All routes ready!');
    } finally {
        // keep it open for vercel or dev
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Echo-Server is running successfully!!!');
});

app.listen(port, () => {
    console.log(`Echo-Server is running on port ${port}`);
});
