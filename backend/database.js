
"use strict";

const { MongoClient } = require("mongodb");
require("dotenv").config();

if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from the root .env file.");
}

const client = new MongoClient(process.env.MONGODB_URI);
let database;

async function connectDB() {
    await client.connect();

    database = client.db(process.env.DB_NAME || "campusconnect");
    await database.command({ ping: 1 });

    await database.collection("users").createIndex(
        { email: 1 },
        { unique: true }
    );

    await database.collection("users").createIndex(
        { studentId: 1 },
        {
            unique: true,
            partialFilterExpression: { studentId: { $type: "string" } }
        }
    );

    await database.collection("complaints").createIndex({ userId: 1, createdAt: -1 });
    await database.collection("complaints").createIndex({ status: 1, createdAt: -1 });
    await database.collection("announcements").createIndex({ createdAt: -1 });

    console.log(`MongoDB connected. Database: ${database.databaseName}`);
    return database;
}

function getDB() {
    if (!database) {
        throw new Error("Database is not connected yet.");
    }
    return database;
}

async function closeDB() {
    await client.close();
}

module.exports = { connectDB, getDB, closeDB };
