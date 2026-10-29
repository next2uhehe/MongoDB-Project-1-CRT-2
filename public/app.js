
"use strict";

const API_BASE = "/api";
const tokenKey = "campusconnect_token";
const userKey = "campusconnect_user";

const getToken = () => sessionStorage.getItem(tokenKey);

function saveSession(token, user) {
    sessionStorage.setItem(tokenKey, token);
    sessionStorage.setItem(userKey, JSON.stringify(user));
}

function getUser() {
    try {
        return JSON.parse(sessionStorage.getItem(userKey) || "null");
    } catch {
        return null;
    }
}

function clearSession() {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(userKey);
}

async function apiRequest(path, options = {}) {
    const headers = { ...(options.headers || {}) };

    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    if (getToken()) {
        headers.Authorization = `Bearer ${getToken()}`;
    }

    let response;

    try {
        response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers
        });
    } catch {
        throw new Error("Cannot reach the server. Start the backend and try again.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || data.error || `Request failed (${response.status}).`);
    }

    return data;
}

function showMessage(id, message, type = "") {
    const element = document.getElementById(id);
    if (!element) return;

    element.textContent = message;
    element.className = `message ${type}`.trim();
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function statusBadge(status) {
    const value = String(status || "Pending");
    const normalized = value.toLowerCase();
    let className = "badge";

    if (normalized === "pending") className += " pending";
    else if (normalized === "in progress") className += " progress";
    else if (normalized === "resolved") className += " resolved";

    return makeElement("span", className, value);
}

function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function requireLogin() {
    if (!getToken()) {
        window.location.replace("login.html");
        return false;
    }
    return true;
}

document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", () => {
        clearSession();
        window.location.replace("login.html");
    });
});

function initAuth() {
    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");
    const loginPanel = document.getElementById("loginPanel");
    const registerPanel = document.getElementById("registerPanel");

    function setMode(mode) {
        const registering = mode === "register";
        loginPanel.hidden = registering;
        registerPanel.hidden = !registering;
        loginTab.classList.toggle("active", !registering);
        registerTab.classList.toggle("active", registering);
        showMessage("authMessage", "");

        if (registering) history.replaceState(null, "", "#register");
        else history.replaceState(null, "", "#login");
    }

    loginTab.addEventListener("click", () => setMode("login"));
    registerTab.addEventListener("click", () => setMode("register"));

    if (location.hash === "#register") setMode("register");

    document.getElementById("loginForm").addEventListener("submit", async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const button = event.currentTarget.querySelector("button[type=submit]");
        button.disabled = true;

        try {
            const data = await apiRequest("/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email: form.get("email"),
                    password: form.get("password")
                })
            });

            if (!data.token || !data.user) {
                throw new Error("The server returned an incomplete login response.");
            }

            saveSession(data.token, data.user);
            window.location.href = data.user.role === "admin"
                ? "admin.html"
                : "dashboard.html";
        } catch (error) {
            showMessage("authMessage", error.message, "error");
        } finally {
            button.disabled = false;
        }
    });

    document.getElementById("registerForm").addEventListener("submit", async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const button = event.currentTarget.querySelector("button[type=submit]");
        button.disabled = true;

        try {
            await apiRequest("/auth/register", {
                method: "POST",
                body: JSON.stringify({
                    name: form.get("name"),
                    email: form.get("email"),
                    studentId: form.get("studentId"),
                    department: form.get("department"),
                    password: form.get("password")
                })
            });

            event.target.reset();
            setMode("login");
            showMessage("authMessage", "Account created. You can now sign in.", "success");
        } catch (error) {
            showMessage("authMessage", error.message, "error");
        } finally {
            button.disabled = false;
        }
    });
}

function renderComplaintCard(complaint) {
    const card = makeElement("article", "item-card");
    const title = makeElement("h3", "", complaint.title || "Untitled complaint");
    const category = makeElement("p", "item-meta", `Category: ${complaint.category || "Other"}`);
    const location = makeElement("p", "item-meta", `Location: ${complaint.location || "Not specified"}`);
    const date = makeElement("p", "item-meta", `Submitted: ${formatDate(complaint.createdAt)}`);
    const description = makeElement("p", "", complaint.description || "");
    const status = statusBadge(complaint.status);

    card.append(title, status, category, location, date, description);
    return card;
}

function initStudentDashboard() {
    const user = getUser();
    const nameElement = document.getElementById("studentName");
    if (user && nameElement) nameElement.textContent = user.name || "Student";

    apiRequest("/dashboard/student")
        .then(data => {
            document.getElementById("totalComplaints").textContent = data.totalComplaints ?? 0;
            document.getElementById("pendingComplaints").textContent = data.pendingComplaints ?? 0;
            document.getElementById("resolvedComplaints").textContent = data.resolvedComplaints ?? 0;

            const container = document.getElementById("recentComplaints");
            container.replaceChildren();

            const complaints = Array.isArray(data.recentComplaints) ? data.recentComplaints : [];
            if (!complaints.length) {
                container.append(makeElement("p", "muted", "You have not submitted any complaints yet."));
                return;
            }

            complaints.forEach(item => container.append(renderComplaintCard(item)));
        })
        .catch(error => showMessage("dashboardMessage", error.message, "error"));
}

function initComplaints() {
    const list = document.getElementById("complaintList");

    async function loadComplaints() {
        try {
            const data = await apiRequest("/complaints");
            const complaints = Array.isArray(data.complaints) ? data.complaints : [];
            list.replaceChildren();

            if (!complaints.length) {
                list.append(makeElement("p", "muted", "No complaints found. Submit your first complaint."));
                return;
            }

            complaints.forEach(item => list.append(renderComplaintCard(item)));
        } catch (error) {
            list.replaceChildren(makeElement("p", "message error", error.message));
        }
    }

    document.getElementById("complaintForm").addEventListener("submit", async event => {
        event.preventDefault();
        const submittedForm = event.currentTarget;
        const form = new FormData(event.currentTarget);
        const button = event.currentTarget.querySelector("button[type=submit]");
        button.disabled = true;

        try {
            await apiRequest("/complaints", {
                method: "POST",
                body: JSON.stringify({
                    title: form.get("title"),
                    category: form.get("category"),
                    location: form.get("location"),
                    description: form.get("description")
                })
            });

            submittedForm.reset();
            showMessage("complaintMessage", "Complaint submitted successfully.", "success");
            await loadComplaints();
        } catch (error) {
            showMessage("complaintMessage", error.message, "error");
        } finally {
            button.disabled = false;
        }
    });

    loadComplaints();
}

function initAnnouncements() {
    const list = document.getElementById("announcementList");

    apiRequest("/announcements")
        .then(data => {
            const announcements = Array.isArray(data.announcements) ? data.announcements : [];
            list.replaceChildren();

            if (!announcements.length) {
                list.append(makeElement("p", "muted", "There are no announcements yet."));
                return;
            }

            announcements.forEach(item => {
                const card = makeElement("article", "announcement-card");
                const title = makeElement("h3", "", item.title || "Untitled announcement");
                const priority = String(item.priority || "Normal");
                const badge = makeElement(
                    "span",
                    priority.toLowerCase() === "urgent" ? "badge urgent" : "badge",
                    priority
                );
                const body = makeElement("p", "", item.body || "");
                const date = makeElement("p", "item-meta", `Published: ${formatDate(item.createdAt)}`);
                card.append(title, badge, body, date);
                list.append(card);
            });
        })
        .catch(error => {
            list.replaceChildren(makeElement("p", "message error", error.message));
        });
}

function initAdmin() {
    async function loadAdminData() {
        try {
            const [stats, complaintData] = await Promise.all([
                apiRequest("/dashboard/admin"),
                apiRequest("/complaints?scope=all")
            ]);

            document.getElementById("adminTotal").textContent = stats.totalComplaints ?? 0;
            document.getElementById("adminPending").textContent = stats.pendingComplaints ?? 0;
            document.getElementById("adminResolved").textContent = stats.resolvedComplaints ?? 0;

            const tbody = document.getElementById("adminComplaintList");
            tbody.replaceChildren();

            const complaints = Array.isArray(complaintData.complaints)
                ? complaintData.complaints
                : [];

            if (!complaints.length) {
                const row = makeElement("tr");
                row.append(makeElement("td", "", "No complaints available."));
                tbody.append(row);
                return;
            }

            complaints.forEach(item => {
                const row = makeElement("tr");
                const titleCell = makeElement("td", "", item.title || "Untitled");
                const categoryCell = makeElement("td", "", item.category || "Other");
                const locationCell = makeElement("td", "", item.location || "—");
                const statusCell = makeElement("td");
                statusCell.append(statusBadge(item.status));

                const actionCell = makeElement("td");
                const select = makeElement("select");
                ["Pending", "In Progress", "Resolved"].forEach(status => {
                    const option = makeElement("option", "", status);
                    option.value = status;
                    option.selected = status === (item.status || "Pending");
                    select.append(option);
                });

                const updateButton = makeElement("button", "btn btn-primary small-button", "Update");
                updateButton.type = "button";
                updateButton.addEventListener("click", async () => {
                    updateButton.disabled = true;
                    try {
                        await apiRequest(`/complaints/${encodeURIComponent(item._id)}/status`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: select.value })
                        });
                        showMessage("adminComplaintMessage", "Complaint status updated.", "success");
                        await loadAdminData();
                    } catch (error) {
                        showMessage("adminComplaintMessage", error.message, "error");
                    } finally {
                        updateButton.disabled = false;
                    }
                });

                actionCell.append(select, updateButton);
                row.append(titleCell, categoryCell, locationCell, statusCell, actionCell);
                tbody.append(row);
            });
        } catch (error) {
            showMessage("adminComplaintMessage", error.message, "error");
        }
    }

    document.getElementById("announcementForm").addEventListener("submit", async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const button = event.currentTarget.querySelector("button[type=submit]");
        button.disabled = true;

        try {
            await apiRequest("/announcements", {
                method: "POST",
                body: JSON.stringify({
                    title: form.get("title"),
                    body: form.get("body"),
                    priority: form.get("priority")
                })
            });

            event.currentTarget.reset();
            showMessage("adminAnnouncementMessage", "Announcement published successfully.", "success");
        } catch (error) {
            showMessage("adminAnnouncementMessage", error.message, "error");
        } finally {
            button.disabled = false;
        }
    });

    loadAdminData();
}

document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;

    if (document.body.dataset.protected === "true" && !requireLogin()) return;

    if (page === "auth") initAuth();
    if (page === "dashboard") initStudentDashboard();
    if (page === "complaints") initComplaints();
    if (page === "announcements") initAnnouncements();
    if (page === "admin") initAdmin();
});
