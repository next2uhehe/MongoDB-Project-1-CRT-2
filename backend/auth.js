
"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDB } = require("./database");
const { ObjectId } = require("mongodb");

const router = express.Router();

function createToken(user) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error("JWT_SECRET must contain at least 32 characters.");
    }

    return jwt.sign(
        { role: user.role },
        process.env.JWT_SECRET,
        {
            subject: user._id.toString(),
            expiresIn: "2h"
        }
    );
}

function authenticateToken(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "Please sign in first." });
    }

    try {
        req.auth = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ message: "Your session is invalid or expired. Please sign in again." });
    }
}

function requireAdmin(req, res, next) {
    if (req.auth?.role !== "admin") {
        return res.status(403).json({ message: "Administrator access is required." });
    }
    next();
}

function publicUser(user) {
    return {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        department: user.department,
        role: user.role
    };
}

router.post("/register", async (req, res, next) => {
    try {
        const { name, email, studentId, department, password } = req.body;

        if (![name, email, studentId, department, password].every(
            value => typeof value === "string" && value.trim()
        )) {
            return res.status(400).json({ message: "Please complete all registration fields." });
        }

        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({ message: "Password must be between 8 and 128 characters." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanStudentId = studentId.trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ message: "Enter a valid email address." });
        }

        const db = getDB();
        const existing = await db.collection("users").findOne({
            $or: [
                { email: cleanEmail },
                { studentId: cleanStudentId }
            ]
        });

        if (existing) {
            return res.status(409).json({ message: "That email or student ID is already registered." });
        }

        const user = {
            name: name.trim(),
            email: cleanEmail,
            studentId: cleanStudentId,
            department: department.trim(),
            passwordHash: await bcrypt.hash(password, 12),
            role: "student",
            createdAt: new Date()
        };

        const result = await db.collection("users").insertOne(user);
        user._id = result.insertedId;

        return res.status(201).json({
            message: "Account created successfully.",
            user: publicUser(user)
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "That email or student ID is already registered." });
        }
        next(error);
    }
});

router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (typeof email !== "string" || typeof password !== "string") {
            return res.status(400).json({ message: "Email and password are required." });
        }

        const user = await getDB().collection("users").findOne({
            email: email.trim().toLowerCase()
        });

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ message: "Incorrect email or password." });
        }

        return res.json({
            message: "Login successful.",
            token: createToken(user),
            user: publicUser(user)
        });
    } catch (error) {
        next(error);
    }
});

router.get("/me", authenticateToken, async (req, res, next) => {
    try {
        if (!ObjectId.isValid(req.auth.sub)) {
            return res.status(401).json({ message: "Invalid session." });
        }

        const user = await getDB().collection("users").findOne(
            { _id: new ObjectId(req.auth.sub) },
            { projection: { passwordHash: 0 } }
        );

        if (!user) {
            return res.status(401).json({ message: "Account not found." });
        }

        res.json({ user: publicUser(user) });
    } catch (error) {
        next(error);
    }
});

module.exports = { router, authenticateToken, requireAdmin };
