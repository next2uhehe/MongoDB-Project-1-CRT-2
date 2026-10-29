
"use strict";

const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("./database");
const { requireAdmin } = require("./auth");

const router = express.Router();

async function complaintStats(filter = {}) {
    const result = await getDB().collection("complaints").aggregate([
        { $match: filter },
        {
            $group: {
                _id: null,
                totalComplaints: { $sum: 1 },
                pendingComplaints: {
                    $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] }
                },
                resolvedComplaints: {
                    $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] }
                }
            }
        }
    ]).toArray();

    return result[0] || {
        totalComplaints: 0,
        pendingComplaints: 0,
        resolvedComplaints: 0
    };
}

router.get("/student", async (req, res, next) => {
    try {
        const userId = new ObjectId(req.auth.sub);
        const db = getDB();

        const [stats, recentComplaints] = await Promise.all([
            complaintStats({ userId }),
            db.collection("complaints")
                .find({ userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .toArray()
        ]);

        res.json({ ...stats, recentComplaints });
    } catch (error) {
        next(error);
    }
});

router.get("/admin", requireAdmin, async (req, res, next) => {
    try {
        const [stats, totalStudents, totalAnnouncements] = await Promise.all([
            complaintStats(),
            getDB().collection("users").countDocuments({ role: "student" }),
            getDB().collection("announcements").countDocuments()
        ]);

        res.json({ ...stats, totalStudents, totalAnnouncements });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
