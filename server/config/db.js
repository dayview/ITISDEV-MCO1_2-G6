const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;

        if (!mongoUri) {
            throw new Error('Missing MONGO_URI. Create a .env file in the project root and set MONGO_URI to your MongoDB connection string.');
        }

        await mongoose.connect(mongoUri);
        console.log('MongoDB connected.');
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
