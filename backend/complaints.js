
"use strict";

const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("./database");
const { requireAdmin } = require("./auth");

const router = express.Router();
const validStatuses = ["Pending", "In Progress", "Resolved"];

router.post("/", async (req, res, next) => {
    try {
        const { title, category, location, description } = req.body;

        if (![title, category, location, description].every(
            value => typeof value === "string" && value.trim()
        )) {
            return res.status(400).json({ message: "All complaint fields are required." });
        }

        if (title.length > 120 || location.length > 150 || description.length > 2000) {
            return res.status(400).json({ message: "One or more fields exceed the allowed length." });
        }

        const db = getDB();
        const userId = new ObjectId(req.auth.sub);
        const user = await db.collection("users").findOne(
            { _id: userId },
            { projection: { name: 1, studentId: 1 } }
        );

        if (!user) {
            return res.status(401).json({ message: "Account not found." });
        }

        const complaint = {
            title: title.trim(),
            category: category.trim(),
            location: location.trim(),
            description: description.trim(),
            userId,
            studentName: user.name,
            studentId: user.studentId,
            status: "Pending",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection("complaints").insertOne(complaint);

        res.status(201).json({
            message: "Complaint submitted successfully.",
            complaint: { ...complaint, _id: result.insertedId }
        });
    } catch (error) {
        next(error);
    }
});

router.get("/", async (req, res, next) => {
    try {
        const isAdmin = req.auth.role === "admin";
        const filter = isAdmin && req.query.scope === "all"
            ? {}
            : { userId: new ObjectId(req.auth.sub) };

        const complaints = await getDB().collection("complaints")
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();

        res.json({ complaints });
    } catch (error) {
        next(error);
    }
});

router.patch("/:id/status", requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid complaint ID." });
        }

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Choose a valid complaint status." });
        }

        const result = await getDB().collection("complaints").updateOne(
            { _id: new ObjectId(id) },
            { $set: { status, updatedAt: new Date() } }
        );

        if (!result.matchedCount) {
            return res.status(404).json({ message: "Complaint not found." });
        }

        res.json({ message: "Complaint status updated successfully." });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
