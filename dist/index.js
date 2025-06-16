// server/index.ts
import express3 from "express";
import { createPool } from "mysql2/promise";

// server/routes.ts
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

// server/storage.ts
import session from "express-session";
import createMemoryStore from "memorystore";
import mysql from "mysql2/promise";
var dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "password",
  database: process.env.MYSQL_DATABASE || "repairconnect",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
var pool = mysql.createPool(dbConfig);
var MemoryStore = createMemoryStore(session);
var MySQLStorage = class {
  sessionStore;
  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 864e5
      // 24 hours
    });
  }
  async getUser(id) {
    try {
      const [rows] = await pool.query(
        "SELECT id, username, password, is_repairman, is_admin, is_blocked FROM users WHERE id = ?",
        [id]
      );
      const users = rows;
      if (users.length === 0) return void 0;
      const user = users[0];
      return {
        id: user.id,
        username: user.username,
        password: user.password,
        isRepairman: Boolean(user.is_repairman),
        isAdmin: Boolean(user.is_admin),
        isBlocked: Boolean(user.is_blocked)
      };
    } catch (error) {
      console.error("Error getting user:", error);
      throw new Error("Failed to get user: " + error.message);
    }
  }
  async getUserByUsername(username) {
    try {
      const [rows] = await pool.query(
        "SELECT id, username, password, is_repairman, is_admin, is_blocked FROM users WHERE username = ?",
        [username]
      );
      const users = rows;
      if (users.length === 0) return void 0;
      const user = users[0];
      return {
        id: user.id,
        username: user.username,
        password: user.password,
        isRepairman: Boolean(user.is_repairman),
        isAdmin: Boolean(user.is_admin),
        isBlocked: Boolean(user.is_blocked)
      };
    } catch (error) {
      console.error("Error getting user by username:", error);
      throw new Error("Failed to get user by username: " + error.message);
    }
  }
  async createUser(insertUser) {
    try {
      console.log("Creating user with data:", {
        username: insertUser.username,
        isRepairman: insertUser.isRepairman
      });
      const [result] = await pool.query(
        "INSERT INTO users (username, password, is_repairman, is_admin, is_blocked, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          insertUser.username,
          insertUser.password,
          insertUser.isRepairman,
          insertUser.username === "admin",
          insertUser.isBlocked || false,
          (/* @__PURE__ */ new Date()).toISOString()
        ]
      );
      const newUser = result;
      console.log("User created successfully:", newUser.insertId);
      return {
        id: newUser.insertId,
        username: insertUser.username,
        password: insertUser.password,
        isRepairman: Boolean(insertUser.isRepairman),
        isAdmin: insertUser.username === "admin",
        isBlocked: Boolean(insertUser.isBlocked) || false
      };
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error("Failed to create user: " + error.message);
    }
  }
  async createListing(listing) {
    try {
      const [result] = await pool.query(
        "INSERT INTO listings (user_id, title, description, category, image_url, budget, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          listing.userId,
          listing.title,
          listing.description,
          listing.category,
          listing.imageUrl,
          listing.budget,
          "open",
          (/* @__PURE__ */ new Date()).toISOString()
        ]
      );
      const newListing = result;
      return {
        id: newListing.insertId,
        userId: listing.userId,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        imageUrl: listing.imageUrl || "",
        // Provide a default value if undefined
        status: "open",
        budget: listing.budget,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("Error creating listing:", error);
      throw new Error("Failed to create listing: " + error.message);
    }
  }
  async getListing(id) {
    try {
      const [rows] = await pool.query(
        "SELECT id, user_id, title, description, category, image_url, status, budget, created_at FROM listings WHERE id = ?",
        [id]
      );
      const listings = rows;
      if (listings.length === 0) return void 0;
      const listing = listings[0];
      return {
        id: listing.id,
        userId: listing.user_id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        imageUrl: listing.image_url,
        status: listing.status,
        budget: listing.budget,
        createdAt: listing.created_at
      };
    } catch (error) {
      console.error("Error getting listing:", error);
      throw new Error("Failed to get listing: " + error.message);
    }
  }
  async getListings() {
    try {
      const [rows] = await pool.query(
        "SELECT id, user_id, title, description, category, image_url, status, budget, created_at FROM listings"
      );
      const listings = rows;
      return listings.map((listing) => ({
        id: listing.id,
        userId: listing.user_id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        imageUrl: listing.image_url,
        status: listing.status,
        budget: listing.budget,
        createdAt: listing.created_at
      }));
    } catch (error) {
      console.error("Error getting listings:", error);
      throw new Error("Failed to get listings: " + error.message);
    }
  }
  async getListingsByCategory(category) {
    try {
      const [rows] = await pool.query(
        "SELECT id, user_id, title, description, category, image_url, status, budget, created_at FROM listings WHERE category LIKE ?",
        [`%${category}%`]
      );
      const listings = rows;
      return listings.map((listing) => ({
        id: listing.id,
        userId: listing.user_id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        imageUrl: listing.image_url,
        status: listing.status,
        budget: listing.budget,
        createdAt: listing.created_at
      }));
    } catch (error) {
      console.error("Error getting listings by category:", error);
      throw new Error("Failed to get listings by category: " + error.message);
    }
  }
  async createBid(bid) {
    try {
      const [result] = await pool.query(
        "INSERT INTO bids (listing_id, repairman_id, amount, comment, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          bid.listingId,
          bid.repairmanId,
          bid.amount,
          bid.comment,
          "pending",
          (/* @__PURE__ */ new Date()).toISOString()
        ]
      );
      const newBid = result;
      return {
        id: newBid.insertId,
        listingId: bid.listingId,
        repairmanId: bid.repairmanId,
        amount: bid.amount,
        comment: bid.comment,
        status: "pending",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("Error creating bid:", error);
      throw new Error("Failed to create bid: " + error.message);
    }
  }
  async getBidsForListing(listingId) {
    try {
      const [rows] = await pool.query(
        "SELECT id, listing_id, repairman_id, amount, comment, status, created_at FROM bids WHERE listing_id = ?",
        [listingId]
      );
      const bids = rows;
      return bids.map((bid) => ({
        id: bid.id,
        listingId: bid.listing_id,
        repairmanId: bid.repairman_id,
        amount: bid.amount,
        comment: bid.comment,
        status: bid.status,
        createdAt: bid.created_at
      }));
    } catch (error) {
      console.error("Error getting bids:", error);
      throw new Error("Failed to get bids: " + error.message);
    }
  }
  async deleteListing(id) {
    try {
      console.log("Attempting to delete listing:", id);
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      try {
        await connection.query("DELETE FROM bids WHERE listing_id = ?", [id]);
        await connection.query("DELETE FROM chat_messages WHERE listing_id = ?", [id]);
        await connection.query("DELETE FROM listings WHERE id = ?", [id]);
        await connection.commit();
        console.log("Successfully deleted listing:", id);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Error deleting listing:", error);
      throw new Error("Failed to delete listing: " + error.message);
    }
  }
  async acceptBid(listingId, bidId) {
    try {
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      try {
        await connection.query(
          "UPDATE listings SET status = ? WHERE id = ?",
          ["in_progress", listingId]
        );
        await connection.query(
          "UPDATE bids SET status = ? WHERE id = ? AND listing_id = ?",
          ["accepted", bidId, listingId]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Error accepting bid:", error);
      throw new Error("Failed to accept bid: " + error.message);
    }
  }
  async createChatMessage(message) {
    try {
      const [result] = await pool.query(
        "INSERT INTO chat_messages (listing_id, sender_id, message, created_at) VALUES (?, ?, ?, ?)",
        [
          message.listingId,
          message.senderId,
          message.message,
          (/* @__PURE__ */ new Date()).toISOString()
        ]
      );
      const newMessage = result;
      return {
        id: newMessage.insertId,
        listingId: message.listingId,
        senderId: message.senderId,
        message: message.message,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("Error creating chat message:", error);
      throw new Error("Failed to create chat message: " + error.message);
    }
  }
  async getChatMessages(listingId) {
    try {
      const [rows] = await pool.query(
        "SELECT id, listing_id, sender_id, message, created_at FROM chat_messages WHERE listing_id = ? ORDER BY created_at ASC",
        [listingId]
      );
      const messages = rows;
      return messages.map((message) => ({
        id: message.id,
        listingId: message.listing_id,
        senderId: message.sender_id,
        message: message.message,
        createdAt: message.created_at
      }));
    } catch (error) {
      console.error("Error getting chat messages:", error);
      throw new Error("Failed to get chat messages: " + error.message);
    }
  }
  async getUsers() {
    try {
      const [rows] = await pool.query(
        "SELECT id, username, password, is_repairman, is_admin, is_blocked FROM users"
      );
      const users = rows;
      return users.map((user) => ({
        id: user.id,
        username: user.username,
        password: user.password,
        isRepairman: Boolean(user.is_repairman),
        isAdmin: Boolean(user.is_admin),
        isBlocked: Boolean(user.is_blocked)
      }));
    } catch (error) {
      console.error("Error getting users:", error);
      throw new Error("Failed to get users: " + error.message);
    }
  }
  async toggleUserBlock(userId) {
    try {
      const [rows] = await pool.query(
        "SELECT is_blocked FROM users WHERE id = ?",
        [userId]
      );
      const users = rows;
      if (users.length === 0) throw new Error("User not found");
      const currentStatus = Boolean(users[0].is_blocked);
      await pool.query(
        "UPDATE users SET is_blocked = ? WHERE id = ?",
        [!currentStatus, userId]
      );
    } catch (error) {
      console.error("Error toggling user block status:", error);
      throw new Error("Failed to toggle user block status: " + error.message);
    }
  }
  async createReview(review) {
    try {
      const [result] = await pool.query(
        "INSERT INTO reviews (listing_id, repairman_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          review.listingId,
          review.repairmanId,
          review.userId,
          review.rating,
          review.comment,
          (/* @__PURE__ */ new Date()).toISOString()
        ]
      );
      const newReview = result;
      return {
        id: newReview.insertId,
        listingId: review.listingId,
        repairmanId: review.repairmanId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("Error creating review:", error);
      throw new Error("Failed to create review: " + error.message);
    }
  }
  async getReviewsForRepairman(repairmanId) {
    try {
      const [rows] = await pool.query(
        "SELECT id, listing_id, repairman_id, user_id, rating, comment, created_at FROM reviews WHERE repairman_id = ? ORDER BY created_at DESC",
        [repairmanId]
      );
      const reviews = rows;
      return reviews.map((review) => ({
        id: review.id,
        listingId: review.listing_id,
        repairmanId: review.repairman_id,
        userId: review.user_id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.created_at
      }));
    } catch (error) {
      console.error("Error getting reviews:", error);
      throw new Error("Failed to get reviews: " + error.message);
    }
  }
  async updateListingStatus(listingId, status) {
    try {
      await pool.query(
        "UPDATE listings SET status = ? WHERE id = ?",
        [status, listingId]
      );
    } catch (error) {
      console.error("Error updating listing status:", error);
      throw new Error("Failed to update listing status: " + error.message);
    }
  }
  async getBidsForRepairman(repairmanId) {
    try {
      const [rows] = await pool.query(
        "SELECT id, listing_id, repairman_id, amount, comment, status, created_at FROM bids WHERE repairman_id = ? ORDER BY created_at DESC",
        [repairmanId]
      );
      const bids = rows;
      return bids.map((bid) => ({
        id: bid.id,
        listingId: bid.listing_id,
        repairmanId: bid.repairman_id,
        amount: bid.amount,
        comment: bid.comment,
        status: bid.status,
        createdAt: bid.created_at
      }));
    } catch (error) {
      console.error("Error getting repairman's bids:", error);
      throw new Error("Failed to get repairman's bids: " + error.message);
    }
  }
  async getUsersByIds(ids) {
    try {
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => "?").join(",");
      const [rows] = await pool.query(
        `SELECT id, username, password, is_repairman, is_admin, is_blocked FROM users WHERE id IN (${placeholders})`,
        ids
      );
      const users = rows;
      return users.map((user) => ({
        id: user.id,
        username: user.username,
        password: user.password,
        isRepairman: Boolean(user.is_repairman),
        isAdmin: Boolean(user.is_admin),
        isBlocked: Boolean(user.is_blocked)
      }));
    } catch (error) {
      console.error("Error getting users by ids:", error);
      throw new Error("Failed to get users by ids: " + error.message);
    }
  }
  async createSubscription(subscription) {
    try {
      console.log("Creating subscription with data:", {
        user_id: subscription.userId,
        amount: subscription.amount,
        payment_proof: subscription.paymentProof
      });
      const [result] = await pool.query(
        "INSERT INTO subscriptions (user_id, amount, payment_proof, status, created_at) VALUES (?, ?, ?, ?, ?)",
        [
          subscription.userId,
          subscription.amount,
          subscription.paymentProof,
          "pending",
          (/* @__PURE__ */ new Date()).toISOString()
        ]
      );
      const newSubscription = result;
      return {
        id: newSubscription.insertId,
        userId: subscription.userId,
        status: "pending",
        amount: subscription.amount,
        paymentProof: subscription.paymentProof,
        startDate: void 0,
        // Changed from null to undefined
        endDate: void 0,
        // Changed from null to undefined
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("Error creating subscription:", error);
      throw new Error("Failed to create subscription: " + error.message);
    }
  }
  async getSubscription(userId) {
    try {
      const [rows] = await pool.query(
        "SELECT id, user_id, status, amount, payment_proof, start_date, end_date, created_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
        [userId]
      );
      const subscriptions = rows;
      if (subscriptions.length === 0) return void 0;
      const subscription = subscriptions[0];
      return {
        id: subscription.id,
        userId: subscription.user_id,
        status: subscription.status,
        amount: subscription.amount,
        paymentProof: subscription.payment_proof,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        createdAt: subscription.created_at
      };
    } catch (error) {
      console.error("Error getting subscription:", error);
      throw new Error("Failed to get subscription: " + error.message);
    }
  }
  async updateSubscriptionStatus(subscriptionId, status, startDate, endDate) {
    try {
      await pool.query(
        "UPDATE subscriptions SET status = ?, start_date = ?, end_date = ? WHERE id = ?",
        [status, startDate, endDate, subscriptionId]
      );
    } catch (error) {
      console.error("Error updating subscription status:", error);
      throw new Error("Failed to update subscription status: " + error.message);
    }
  }
  async getPendingSubscriptions() {
    try {
      const [rows] = await pool.query(`
        SELECT s.id, s.user_id, s.status, s.amount, s.payment_proof, s.start_date, s.end_date, s.created_at, u.username
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE s.status = 'pending'
        ORDER BY s.created_at DESC
      `);
      const subscriptions = rows;
      return subscriptions.map((subscription) => ({
        id: subscription.id,
        userId: subscription.user_id,
        status: subscription.status,
        amount: subscription.amount,
        paymentProof: subscription.payment_proof,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        createdAt: subscription.created_at,
        username: subscription.username
      }));
    } catch (error) {
      console.error("Error getting pending subscriptions:", error);
      throw new Error("Failed to get pending subscriptions: " + error.message);
    }
  }
};
var storage = new MySQLStorage();

// shared/schema.ts
import { z } from "zod";
var insertUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  isRepairman: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
  isBlocked: z.boolean().default(false)
});
var insertListingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  imageUrl: z.string().url("Must be a valid URL").optional(),
  budget: z.number().min(1, "Budget must be greater than 0").optional()
});
var finalListingSchema = insertListingSchema.extend({
  imageUrl: z.string().url("Must be a valid URL")
});
var insertBidSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  comment: z.string().optional()
});
var insertChatMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty")
});
var insertReviewSchema = z.object({
  rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().min(1, "Comment is required")
});
var insertSubscriptionSchema = z.object({
  userId: z.number(),
  amount: z.number().min(300, "Subscription amount must be \u20B9300").max(300, "Subscription amount must be \u20B9300"),
  paymentProof: z.any()
  // Accept both File object and string URL
});

// server/auth.ts
var scryptAsync = promisify(scrypt);
async function comparePasswords(supplied, stored) {
  try {
    if (supplied === stored) {
      return true;
    }
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = await scryptAsync(supplied, salt, 64);
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return supplied === stored;
  }
}
function setupAuth(app2) {
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = randomBytes(32).toString("hex");
  }
  const sessionSettings = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1e3
      // 24 hours
    }
  };
  app2.set("trust proxy", 1);
  app2.use(session2(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("Attempting login for username:", username);
        const user = await storage.getUserByUsername(username);
        if (!user || !await comparePasswords(password, user.password)) {
          console.log("Login failed - Invalid credentials");
          return done(null, false, { message: "Invalid username or password" });
        }
        console.log("Login successful for user:", username);
        return done(null, user);
      } catch (error) {
        console.error("Login error:", error);
        return done(error);
      }
    })
  );
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("Deserialization error:", error);
      done(error);
    }
  });
  app2.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registration attempt:", req.body);
      const validationResult = insertUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.log("Validation failed:", validationResult.error);
        return res.status(400).json({
          message: "Invalid input",
          errors: validationResult.error.errors
        });
      }
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log("Username already exists:", req.body.username);
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser({
        username: req.body.username,
        password: req.body.password,
        isRepairman: req.body.isRepairman || false,
        isAdmin: false,
        isBlocked: false
      });
      req.login(user, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return next(err);
        }
        console.log("Registration successful:", user.username);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });
  app2.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("Authentication error:", err);
        return next(err);
      }
      if (!user) {
        console.log("Authentication failed:", info?.message);
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      req.login(user, (err2) => {
        if (err2) {
          console.error("Session creation error:", err2);
          return next(err2);
        }
        console.log("Login successful:", user.username);
        res.status(200).json(user);
      });
    })(req, res, next);
  });
  app2.post("/api/logout", (req, res, next) => {
    const username = req.user?.username;
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return next(err);
      }
      console.log("Logout successful:", username);
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("Unauthorized access attempt to /api/user");
      return res.sendStatus(401);
    }
    res.json(req.user);
  });
}

// server/routes.ts
import multer from "multer";
import path from "path";
import express from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var uploadsDir = path.join(__dirname, "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
console.log("Uploads directory created/verified at:", uploadsDir);
var multerStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});
var upload = multer({
  storage: multerStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG and GIF are allowed."));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024
    // 5MB limit
  }
});
async function registerRoutes(app2) {
  app2.get("/ping", (req, res) => {
    console.log("Ping endpoint hit");
    res.send("pong");
  });
  setupAuth(app2);
  app2.use("/uploads", express.static(uploadsDir));
  console.log("Serving uploads from:", uploadsDir);
  app2.use("/images", express.static(path.join(__dirname, "public", "images")));
  console.log("Serving static images from:", path.join(__dirname, "public", "images"));
  app2.post("/api/upload", upload.single("image"), (req, res) => {
    console.log("Upload request received");
    if (!req.isAuthenticated()) {
      console.error("Unauthorized upload attempt");
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!req.file) {
      console.error("No file received in upload request");
      return res.status(400).json({ message: "No file uploaded" });
    }
    try {
      const imageUrl = `/uploads/${req.file.filename}`;
      console.log("File uploaded successfully:", imageUrl);
      res.json({ imageUrl });
    } catch (error) {
      console.error("Error processing upload:", error);
      res.status(500).json({ message: "Failed to process upload" });
    }
  });
  app2.get("/api/listings", async (req, res) => {
    try {
      console.log("Fetching listings...");
      const listings = await storage.getListings();
      console.log(`Successfully fetched ${listings.length} listings`);
      res.json(listings);
    } catch (error) {
      console.error("Error fetching listings:", error);
      res.status(500).json({
        message: "Failed to fetch listings",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/listings/category/:category", async (req, res) => {
    console.log("Fetching listings for category:", req.params.category);
    try {
      const listings = await storage.getListingsByCategory(req.params.category);
      console.log("Found listings:", listings.length);
      console.log("Listings:", JSON.stringify(listings, null, 2));
      res.json(listings);
    } catch (error) {
      console.error("Error fetching category listings:", error);
      res.status(500).json({ message: "Failed to fetch listings" });
    }
  });
  app2.post("/api/listings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const result = insertListingSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }
    const listing = await storage.createListing({
      ...result.data,
      userId: req.user.id
    });
    res.status(201).json(listing);
  });
  app2.delete("/api/listings/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log("Unauthorized delete attempt");
      return res.status(401).json({ message: "Unauthorized" });
    }
    const listingId = parseInt(req.params.id);
    if (isNaN(listingId)) {
      console.log("Invalid listing ID:", req.params.id);
      return res.status(400).json({ message: "Invalid listing ID" });
    }
    try {
      const listing = await storage.getListing(listingId);
      if (!listing) {
        console.log("Listing not found:", listingId);
        return res.status(404).json({ message: "Listing not found" });
      }
      if (listing.userId !== req.user.id) {
        console.log("Unauthorized delete - User:", req.user.id, "Listing owner:", listing.userId);
        return res.status(403).json({ message: "Not authorized to delete this listing" });
      }
      await storage.deleteListing(listingId);
      console.log("Listing deleted successfully:", listingId);
      res.status(200).json({ message: "Listing deleted successfully" });
    } catch (error) {
      console.error("Error deleting listing:", error);
      res.status(500).json({ message: "Failed to delete listing" });
    }
  });
  app2.post("/api/listings/:listingId/bids", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user.isRepairman) return res.status(403).send("Only repairmen can bid");
    try {
      const subscription = await storage.getSubscription(req.user.id);
      if (!subscription || subscription.status !== "active") {
        return res.status(403).json({
          message: "You need an active subscription to place bids. Please subscribe and wait for admin verification."
        });
      }
      const result = insertBidSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json(result.error);
      }
      const listingId = parseInt(req.params.listingId);
      const listing = await storage.getListing(listingId);
      if (!listing) return res.status(404).send("Listing not found");
      const bid = await storage.createBid({
        ...result.data,
        listingId,
        repairmanId: req.user.id
      });
      res.status(201).json(bid);
    } catch (error) {
      console.error("Error creating bid:", error);
      res.status(500).json({ message: "Failed to create bid" });
    }
  });
  app2.get("/api/listings/:listingId/bids", async (req, res) => {
    const listingId = parseInt(req.params.listingId);
    try {
      const bids = await storage.getBidsForListing(listingId);
      const repairmanIds = bids.map((bid) => bid.repairmanId);
      const users = await storage.getUsersByIds(repairmanIds);
      const bidsWithUsernames = bids.map((bid) => ({
        ...bid,
        repairmanName: users.find((u) => u.id === bid.repairmanId)?.username || "Unknown"
      }));
      res.json(bidsWithUsernames);
    } catch (error) {
      console.error("Error fetching bids:", error);
      res.status(500).json({ message: "Failed to fetch bids" });
    }
  });
  app2.get("/api/bids/repairman", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!req.user.isRepairman) {
      return res.status(403).json({ message: "Only repairmen can view their bids" });
    }
    try {
      const bids = await storage.getBidsForRepairman(req.user.id);
      res.json(bids);
    } catch (error) {
      console.error("Error getting repairman's bids:", error);
      res.status(500).json({ message: "Failed to get bids" });
    }
  });
  app2.post("/api/listings/:listingId/accept-bid/:bidId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const listingId = parseInt(req.params.listingId);
    const bidId = parseInt(req.params.bidId);
    try {
      const listing = await storage.getListing(listingId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      if (listing.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to accept bids for this listing" });
      }
      await storage.acceptBid(listingId, bidId);
      res.json({ message: "Bid accepted successfully" });
    } catch (error) {
      console.error("Error accepting bid:", error);
      res.status(500).json({ message: "Failed to accept bid" });
    }
  });
  app2.post("/api/listings/:listingId/complete", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!req.user.isRepairman) {
      return res.status(403).json({ message: "Only repairmen can complete repairs" });
    }
    const listingId = parseInt(req.params.listingId);
    if (isNaN(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID" });
    }
    try {
      const bids = await storage.getBidsForListing(listingId);
      const acceptedBid = bids.find(
        (bid) => bid.repairmanId === req.user.id && bid.status === "accepted"
      );
      if (!acceptedBid) {
        return res.status(403).json({ message: "Not authorized to complete this repair" });
      }
      await storage.updateListingStatus(listingId, "completed");
      res.json({ message: "Repair marked as completed" });
    } catch (error) {
      console.error("Error completing repair:", error);
      res.status(500).json({ message: "Failed to complete repair" });
    }
  });
  app2.get("/api/listings/:listingId/messages", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const listingId = parseInt(req.params.listingId);
    if (isNaN(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID" });
    }
    try {
      const messages = await storage.getChatMessages(listingId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });
  app2.use("/myqr", express.static(path.join(__dirname, "../myqr")));
  console.log("Serving QR code from:", path.join(__dirname, "../myqr"));
  app2.post("/api/subscription", async (req, res) => {
    console.log("Subscription request received:", req.body);
    if (!req.isAuthenticated()) {
      console.error("Unauthorized subscription attempt");
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!req.user.isRepairman) {
      console.error("Non-repairman subscription attempt");
      return res.status(403).json({ message: "Only repairmen can subscribe" });
    }
    try {
      const validationResult = insertSubscriptionSchema.safeParse({
        ...req.body,
        userId: req.user.id
      });
      if (!validationResult.success) {
        console.error("Subscription validation failed:", validationResult.error);
        return res.status(400).json({
          message: "Invalid subscription data",
          errors: validationResult.error.errors
        });
      }
      console.log("Creating subscription with validated data:", validationResult.data);
      const subscription = await storage.createSubscription(validationResult.data);
      console.log("Subscription created successfully:", subscription);
      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({
        message: "Failed to create subscription",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/subscription", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const subscription = await storage.getSubscription(req.user.id);
      res.json(subscription);
    } catch (error) {
      console.error("Error getting subscription:", error);
      res.status(500).json({ message: "Failed to get subscription" });
    }
  });
  app2.get("/api/admin/subscriptions/pending", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    try {
      const subscriptions = await storage.getPendingSubscriptions();
      res.json(subscriptions);
    } catch (error) {
      console.error("Error getting pending subscriptions:", error);
      res.status(500).json({ message: "Failed to get pending subscriptions" });
    }
  });
  app2.post("/api/admin/subscriptions/:id/verify", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const subscriptionId = parseInt(req.params.id);
    if (isNaN(subscriptionId)) {
      return res.status(400).json({ message: "Invalid subscription ID" });
    }
    try {
      const startDate = (/* @__PURE__ */ new Date()).toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
      await storage.updateSubscriptionStatus(subscriptionId, "active", startDate, endDate);
      res.json({ message: "Subscription verified successfully" });
    } catch (error) {
      console.error("Error verifying subscription:", error);
      res.status(500).json({ message: "Failed to verify subscription" });
    }
  });
  app2.post("/api/admin/subscriptions/:id/reject", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const subscriptionId = parseInt(req.params.id);
    if (isNaN(subscriptionId)) {
      return res.status(400).json({ message: "Invalid subscription ID" });
    }
    try {
      await storage.updateSubscriptionStatus(subscriptionId, "expired");
      res.json({ message: "Subscription rejected successfully" });
    } catch (error) {
      console.error("Error rejecting subscription:", error);
      res.status(500).json({ message: "Failed to reject subscription" });
    }
  });
  app2.post("/api/listings/:listingId/reviews", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const listingId = parseInt(req.params.listingId);
    if (isNaN(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID" });
    }
    try {
      const result = insertReviewSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json(result.error);
      }
      const listing = await storage.getListing(listingId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }
      const bids = await storage.getBidsForListing(listingId);
      const acceptedBid = bids.find((bid) => bid.status === "accepted");
      if (!acceptedBid) {
        return res.status(400).json({ message: "No accepted bid found for this listing" });
      }
      const review = await storage.createReview({
        ...result.data,
        listingId,
        repairmanId: acceptedBid.repairmanId,
        userId: req.user.id
      });
      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });
  app2.get("/api/repairmen/:repairmanId/reviews", async (req, res) => {
    const repairmanId = parseInt(req.params.repairmanId);
    if (isNaN(repairmanId)) {
      return res.status(400).json({ message: "Invalid repairman ID" });
    }
    try {
      const reviews = await storage.getReviewsForRepairman(repairmanId);
      res.json(reviews);
    } catch (error) {
      console.error("Error getting reviews:", error);
      res.status(500).json({ message: "Failed to get reviews" });
    }
  });
  app2.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app2.delete("/api/admin/listings/:id", async (req, res) => {
    console.log("Admin delete listing request received for listing:", req.params.id);
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      console.log("Unauthorized admin delete attempt");
      return res.status(403).json({ message: "Unauthorized" });
    }
    try {
      const listingId = parseInt(req.params.id);
      if (isNaN(listingId)) {
        console.log("Invalid listing ID:", req.params.id);
        return res.status(400).json({ message: "Invalid listing ID" });
      }
      await storage.deleteListing(listingId);
      console.log("Listing deleted successfully by admin:", listingId);
      res.json({ message: "Listing deleted successfully" });
    } catch (error) {
      console.error("Error in admin delete listing:", error);
      res.status(500).json({
        message: "Failed to delete listing",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/admin/users/:id/toggle-block", async (req, res) => {
    console.log("Admin toggle block request received for user:", req.params.id);
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      console.log("Unauthorized admin block attempt");
      return res.status(403).json({ message: "Unauthorized" });
    }
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        console.log("Invalid user ID:", req.params.id);
        return res.status(400).json({ message: "Invalid user ID" });
      }
      await storage.toggleUserBlock(userId);
      console.log("User block status toggled successfully:", userId);
      res.json({ message: "User status updated successfully" });
    } catch (error) {
      console.error("Error in admin toggle block:", error);
      res.status(500).json({
        message: "Failed to update user status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  const httpServer = createServer(app2);
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws"
  });
  const connections = /* @__PURE__ */ new Map();
  wss.on("connection", (ws) => {
    console.log("New WebSocket connection");
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data);
        console.log("Received WebSocket message:", message);
        if (!message.type || !message.data) {
          throw new Error("Invalid message format");
        }
        switch (message.type) {
          case "auth":
            connections.set(message.data.userId, ws);
            console.log("Authenticated WebSocket for user:", message.data.userId);
            break;
          case "chat":
            const validatedMessage = insertChatMessageSchema.parse(message.data);
            const { listingId, recipientId } = message.data;
            const savedMessage = await storage.createChatMessage({
              ...validatedMessage,
              listingId,
              senderId: message.data.senderId
            });
            const recipientWs = connections.get(recipientId);
            const senderWs = connections.get(message.data.senderId);
            const messagePayload = JSON.stringify({
              type: "chat",
              data: savedMessage
            });
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(messagePayload);
            }
            if (senderWs && senderWs.readyState === WebSocket.OPEN) {
              senderWs.send(messagePayload);
            }
            break;
        }
      } catch (error) {
        console.error("WebSocket error:", error);
        ws.send(JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error"
        }));
      }
    });
    ws.on("close", () => {
      connections.forEach((socket, userId) => {
        if (socket === ws) {
          connections.delete(userId);
        }
      });
    });
  });
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs2 from "fs";
import path3, { dirname as dirname3 } from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path2, { dirname as dirname2 } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath as fileURLToPath2 } from "url";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path2.resolve(__dirname2, "client", "src"),
      "@shared": path2.resolve(__dirname2, "shared")
    }
  },
  root: path2.resolve(__dirname2, "client"),
  build: {
    outDir: path2.resolve(__dirname2, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = dirname3(__filename3);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        __dirname3,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}

// server/index.ts
import dotenv from "dotenv";
dotenv.config();
var db = createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "easyrepair",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
var app = express3();
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
  });
  next();
});
app.get("/api/db-test", async (req, res) => {
  try {
    const [result] = await db.query("SELECT 1 as connection_test");
    res.json({
      success: true,
      message: "Database connection successful",
      data: result
    });
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message
    });
  }
});
(async () => {
  try {
    log("Starting server...");
    try {
      log("Testing database connection...");
      const [rows] = await db.query("SELECT 1 as connection_test");
      log("Database connection established successfully");
    } catch (dbError) {
      console.error("Failed to connect to MySQL database:", dbError);
      process.exit(1);
    }
    const server = await registerRoutes(app);
    log("Routes registered successfully");
    app.use((err, _req, res, _next) => {
      console.error("Error:", err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });
    log("Setting up Vite development server");
    await setupVite(app, server);
    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port}`);
      log(`MySQL connection established to ${process.env.DB_HOST || "localhost"}`);
      if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        log(`Access your server at: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
        log(`Test endpoint available at: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/ping`);
        log(`Database connection test: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/db-test`);
      }
    }).on("error", (err) => {
      console.error("Server startup error:", err);
      process.exit(1);
    });
  } catch (error) {
    console.error("Fatal error during server startup:", error);
    process.exit(1);
  }
})();
export {
  db
};
