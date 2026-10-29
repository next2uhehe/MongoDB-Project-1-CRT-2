
"use strict";

const express = require("express");
const { getDB } = require("./database");
const { requireAdmin } = require("./auth");

const router = express.Router();
const validPriorities = ["Normal", "Important", "Urgent"];

router.get("/", async (req, res, next) => {
    try {
        const announcements = await getDB().collection("announcements")
            .find({})
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();

        res.json({ announcements });
    } catch (error) {
        next(error);
    }
});

router.post("/", requireAdmin, async (req, res, next) => {
    try {
        const { title, body, priority = "Normal" } = req.body;

        if (typeof title !== "string" || !title.trim() ||
            typeof body !== "string" || !body.trim()) {
            return res.status(400).json({ message: "Title and announcement details are required." });
        }

        if (title.length > 150 || body.length > 4000) {
            return res.status(400).json({ message: "The announcement exceeds the allowed length." });
        }

        if (!validPriorities.includes(priority)) {
            return res.status(400).json({ message: "Choose a valid priority." });
        }

        const announcement = {
            title: title.trim(),
            body: body.trim(),
            priority,
            createdBy: req.auth.sub,
            createdAt: new Date()
        };

        const result = await getDB().collection("announcements").insertOne(announcement);

        res.status(201).json({
            message: "Announcement published successfully.",
            announcement: { ...announcement, _id: result.insertedId }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
