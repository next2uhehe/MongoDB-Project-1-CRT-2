
"use strict";

require("dotenv").config();

const express = require("express");
const path = require("path");
const { connectDB, closeDB } = require("./database");
const { router: authRouter, authenticateToken } = require("./auth");
const complaintsRouter = require("./complaints");
const announcementsRouter = require("./announcements");
const dashboardRouter = require("./dashboard");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "CampusConnect API is running." });
});

app.use("/api/auth", authRouter);
app.use("/api/complaints", authenticateToken, complaintsRouter);
app.use("/api/announcements", authenticateToken, announcementsRouter);
app.use("/api/dashboard", authenticateToken, dashboardRouter);

app.use("/api", (req, res) => {
    res.status(404).json({ message: "API endpoint not found." });
});

app.use((error, req, res, next) => {
    console.error(error.message || "Unexpected server error");

    if (res.headersSent) return next(error);

    res.status(500).json({
        message: "An internal server error occurred."
    });
});

let server;

async function startServer() {
    try {
        await connectDB();

        server = app.listen(PORT, () => {
            console.log(`CampusConnect running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start CampusConnect:", error.message);
        process.exitCode = 1;
    }
}

async function shutdown() {
    console.log("Shutting down CampusConnect...");

    if (server) {
        await new Promise(resolve => server.close(resolve));
    }

    try {
        await closeDB();
    } catch (error) {
        console.error("Error closing database:", error.message);
    }

    process.exit();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();
