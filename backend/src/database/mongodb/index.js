// backend/src/database/mongodb/index.js
// MongoDB connection manager using Mongoose.
// Per FOLDER_STRUCTURE.md §backend/src/database/:
//   "Database connection setup is centralised here; controllers/services never import Mongoose directly."

'use strict';

const mongoose = require('mongoose');
const config = require('../../config');

let isConnected = false;

/**
 * Connect to MongoDB instance using Mongoose.
 */
async function connectMongoDB() {
  if (isConnected) {
    return;
  }

  const mongoUri = process.env.MONGODB_URI || config.mongodb?.uri;

  if (!mongoUri) {
    console.warn('⚠️ MONGODB_URI is not set. MongoDB features will not be available.');
    return;
  }

  try {
    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () => {
      console.log('🍃 Connected to MongoDB (Document Store)');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB Connection Error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB Disconnected');
      isConnected = false;
    });

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    // Do not crash the entire process if MongoDB is temporarily unreachable
  }
}

/**
 * Gracefully disconnect from MongoDB.
 */
async function disconnectMongoDB() {
  if (isConnected || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('🍃 MongoDB connection closed cleanly');
  }
}

module.exports = {
  connectMongoDB,
  disconnectMongoDB,
  mongoose,
};
