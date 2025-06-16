import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertListingSchema, insertBidSchema, insertReviewSchema, insertChatMessageSchema, insertSubscriptionSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
console.log('Uploads directory created/verified at:', uploadsDir);

// Configure multer for handling file uploads
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: multerStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Add a test endpoint
  app.get('/ping', (req, res) => {
    console.log('Ping endpoint hit');
    res.send('pong');
  });

  setupAuth(app);

  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));
  console.log('Serving uploads from:', uploadsDir);

  // Serve static files from public directory
  app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
  console.log('Serving static images from:', path.join(__dirname, 'public', 'images'));

  // Image upload endpoint - add better logging
  app.post("/api/upload", upload.single('image'), (req, res) => {
    console.log('Upload request received');

    if (!req.isAuthenticated()) {
      console.error('Unauthorized upload attempt');
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      console.error('No file received in upload request');
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      const imageUrl = `/uploads/${req.file.filename}`;
      console.log('File uploaded successfully:', imageUrl);
      res.json({ imageUrl });
    } catch (error) {
      console.error('Error processing upload:', error);
      res.status(500).json({ message: "Failed to process upload" });
    }
  });

  // Listings
  app.get("/api/listings", async (req, res) => {
    try {
      console.log('Fetching listings...');
      const listings = await storage.getListings();
      console.log(`Successfully fetched ${listings.length} listings`);
      res.json(listings);
    } catch (error) {
      console.error('Error fetching listings:', error);
      res.status(500).json({ 
        message: "Failed to fetch listings",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/listings/category/:category", async (req, res) => {
    console.log('Fetching listings for category:', req.params.category);
    try {
      const listings = await storage.getListingsByCategory(req.params.category);
      console.log('Found listings:', listings.length);
      console.log('Listings:', JSON.stringify(listings, null, 2));
      res.json(listings);
    } catch (error) {
      console.error('Error fetching category listings:', error);
      res.status(500).json({ message: "Failed to fetch listings" });
    }
  });

  app.post("/api/listings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertListingSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    const listing = await storage.createListing({
      ...result.data,
      userId: req.user.id,
    });
    res.status(201).json(listing);
  });

  // Update the delete endpoint with better error handling
  app.delete("/api/listings/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log('Unauthorized delete attempt');
      return res.status(401).json({ message: "Unauthorized" });
    }

    const listingId = parseInt(req.params.id);
    if (isNaN(listingId)) {
      console.log('Invalid listing ID:', req.params.id);
      return res.status(400).json({ message: "Invalid listing ID" });
    }

    try {
      const listing = await storage.getListing(listingId);
      if (!listing) {
        console.log('Listing not found:', listingId);
        return res.status(404).json({ message: "Listing not found" });
      }

      if (listing.userId !== req.user.id) {
        console.log('Unauthorized delete - User:', req.user.id, 'Listing owner:', listing.userId);
        return res.status(403).json({ message: "Not authorized to delete this listing" });
      }

      await storage.deleteListing(listingId);
      console.log('Listing deleted successfully:', listingId);
      res.status(200).json({ message: "Listing deleted successfully" });
    } catch (error) {
      console.error('Error deleting listing:', error);
      res.status(500).json({ message: "Failed to delete listing" });
    }
  });

  // Bids
  app.post("/api/listings/:listingId/bids", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user.isRepairman) return res.status(403).send("Only repairmen can bid");

    // Check if repairman has an active subscription
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
        repairmanId: req.user.id,
      });
      res.status(201).json(bid);
    } catch (error) {
      console.error("Error creating bid:", error);
      res.status(500).json({ message: "Failed to create bid" });
    }
  });

  app.get("/api/listings/:listingId/bids", async (req, res) => {
    const listingId = parseInt(req.params.listingId);
    try {
      const bids = await storage.getBidsForListing(listingId);

      // Get usernames for all repairmen
      const repairmanIds = bids.map(bid => bid.repairmanId);
      const users = await storage.getUsersByIds(repairmanIds);

      // Attach username to each bid
      const bidsWithUsernames = bids.map(bid => ({
        ...bid,
        repairmanName: users.find(u => u.id === bid.repairmanId)?.username || 'Unknown'
      }));

      res.json(bidsWithUsernames);
    } catch (error) {
      console.error('Error fetching bids:', error);
      res.status(500).json({ message: "Failed to fetch bids" });
    }
  });

  app.get("/api/bids/repairman", async (req, res) => {
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

  app.post("/api/listings/:listingId/accept-bid/:bidId", async (req, res) => {
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
      console.error('Error accepting bid:', error);
      res.status(500).json({ message: "Failed to accept bid" });
    }
  });

  // Add this endpoint before the review endpoints
  app.post("/api/listings/:listingId/complete", async (req, res) => {
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
      // Check if the repairman has an accepted bid for this listing
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

  // Add this endpoint after the existing chat-related code
  app.get("/api/listings/:listingId/messages", async (req, res) => {
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
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });


  // Add this after other static file serving middleware
  app.use('/myqr', express.static(path.join(__dirname, '../myqr')));
  console.log('Serving QR code from:', path.join(__dirname, '../myqr'));

  // Update subscription creation endpoint with better validation and logging
  app.post("/api/subscription", async (req, res) => {
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
      // Validate request data
      const validationResult = insertSubscriptionSchema.safeParse({
        ...req.body,
        userId: req.user.id,
      });

      if (!validationResult.success) {
        console.error("Subscription validation failed:", validationResult.error);
        return res.status(400).json({ 
          message: "Invalid subscription data", 
          errors: validationResult.error.errors 
        });
      }

      // Create subscription
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

  // Get user's subscription status
  app.get("/api/subscription", async (req, res) => {
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

  // Get all pending subscriptions (admin only)
  app.get("/api/admin/subscriptions/pending", async (req, res) => {
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

  // Verify subscription (admin only)
  app.post("/api/admin/subscriptions/:id/verify", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const subscriptionId = parseInt(req.params.id);
    if (isNaN(subscriptionId)) {
      return res.status(400).json({ message: "Invalid subscription ID" });
    }

    try {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now
      await storage.updateSubscriptionStatus(subscriptionId, "active", startDate, endDate);
      res.json({ message: "Subscription verified successfully" });
    } catch (error) {
      console.error("Error verifying subscription:", error);
      res.status(500).json({ message: "Failed to verify subscription" });
    }
  });

  // Add this next to other subscription endpoints
  app.post("/api/admin/subscriptions/:id/reject", async (req, res) => {
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

  // Add review endpoints after the chat endpoints
  app.post("/api/listings/:listingId/reviews", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const listingId = parseInt(req.params.listingId);
    if (isNaN(listingId)) {
      return res.status(400).json({ message: "Invalid listing ID" });
    }

    try {
      // Validate review data
      const result = insertReviewSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json(result.error);
      }

      // Get the listing to check if it exists and get the repairman ID
      const listing = await storage.getListing(listingId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Get the accepted bid to get the repairman ID
      const bids = await storage.getBidsForListing(listingId);
      const acceptedBid = bids.find(bid => bid.status === "accepted");
      if (!acceptedBid) {
        return res.status(400).json({ message: "No accepted bid found for this listing" });
      }

      // Create the review
      const review = await storage.createReview({
        ...result.data,
        listingId,
        repairmanId: acceptedBid.repairmanId,
        userId: req.user.id,
      });

      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  app.get("/api/repairmen/:repairmanId/reviews", async (req, res) => {
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

  // Admin Routes - All require admin authentication
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.delete("/api/admin/listings/:id", async (req, res) => {
    console.log('Admin delete listing request received for listing:', req.params.id);

    if (!req.isAuthenticated() || !req.user.isAdmin) {
      console.log('Unauthorized admin delete attempt');
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const listingId = parseInt(req.params.id);
      if (isNaN(listingId)) {
        console.log('Invalid listing ID:', req.params.id);
        return res.status(400).json({ message: "Invalid listing ID" });
      }

      await storage.deleteListing(listingId);
      console.log('Listing deleted successfully by admin:', listingId);
      res.json({ message: "Listing deleted successfully" });
    } catch (error) {
      console.error('Error in admin delete listing:', error);
      res.status(500).json({ 
        message: "Failed to delete listing",
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.post("/api/admin/users/:id/toggle-block", async (req, res) => {
    console.log('Admin toggle block request received for user:', req.params.id);

    if (!req.isAuthenticated() || !req.user.isAdmin) {
      console.log('Unauthorized admin block attempt');
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        console.log('Invalid user ID:', req.params.id);
        return res.status(400).json({ message: "Invalid user ID" });
      }

      await storage.toggleUserBlock(userId);
      console.log('User block status toggled successfully:', userId);
      res.json({ message: "User status updated successfully" });
    } catch (error) {
      console.error('Error in admin toggle block:', error);
      res.status(500).json({ 
        message: "Failed to update user status",
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  const httpServer = createServer(app);

  // Update WebSocket setup section
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });

  // Store active connections
  const connections = new Map<number, WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection');

    ws.on('message', async (data: string) => {
      try {
        const message = JSON.parse(data);
        console.log('Received WebSocket message:', message);

        // Validate the message format
        if (!message.type || !message.data) {
          throw new Error('Invalid message format');
        }

        switch (message.type) {
          case 'auth':
            // Store the connection with the user ID
            connections.set(message.data.userId, ws);
            console.log('Authenticated WebSocket for user:', message.data.userId);
            break;

          case 'chat':
            const validatedMessage = insertChatMessageSchema.parse(message.data);
            const { listingId, recipientId } = message.data;

            // Store the message
            const savedMessage = await storage.createChatMessage({
              ...validatedMessage,
              listingId,
              senderId: message.data.senderId,
            });

            // Send to both recipient and sender
            const recipientWs = connections.get(recipientId);
            const senderWs = connections.get(message.data.senderId);

            const messagePayload = JSON.stringify({
              type: 'chat',
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
        console.error('WebSocket error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    });

    ws.on('close', () => {
      // Remove connection when closed
      connections.forEach((socket, userId) => {
        if (socket === ws) {
          connections.delete(userId);
        }
      });
    });
  });

  return httpServer;
}