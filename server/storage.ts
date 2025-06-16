import {
  User,
  InsertUser,
  Listing,
  InsertListing,
  Bid,
  InsertBid,
  ChatMessage,
  InsertChatMessage,
  Review,
  InsertReview,
  Subscription,
  InsertSubscription,
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import mysql from "mysql2/promise";

// MySQL connection configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'Sudo',
  database: process.env.MYSQL_DATABASE || 'easyrepair',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create MySQL connection pool
const pool = mysql.createPool(dbConfig);

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  sessionStore: session.Store;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createListing(listing: InsertListing & { userId: number }): Promise<Listing>;
  getListing(id: number): Promise<Listing | undefined>;
  getListings(): Promise<Listing[]>;
  getListingsByCategory(category: string): Promise<Listing[]>;
  createBid(
    bid: InsertBid & { listingId: number; repairmanId: number },
  ): Promise<Bid>;
  getBidsForListing(listingId: number): Promise<Bid[]>;
  deleteListing(id: number): Promise<void>;
  acceptBid(listingId: number, bidId: number): Promise<void>;
  createChatMessage(
    message: InsertChatMessage & { listingId: number; senderId: number },
  ): Promise<ChatMessage>;
  getChatMessages(listingId: number): Promise<ChatMessage[]>;
  getUsers(): Promise<User[]>;
  toggleUserBlock(userId: number): Promise<void>;
  createReview(review: InsertReview & { 
    listingId: number;
    repairmanId: number;
    userId: number;
  }): Promise<Review>;
  getReviewsForRepairman(repairmanId: number): Promise<Review[]>;
  updateListingStatus(listingId: number, status: string): Promise<void>;
  getBidsForRepairman(repairmanId: number): Promise<Bid[]>;
  getUsersByIds(ids: number[]): Promise<User[]>;
  // Subscription methods
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getSubscription(userId: number): Promise<Subscription | undefined>;
  updateSubscriptionStatus(
    subscriptionId: number,
    status: "active" | "expired",
    startDate?: string | null,
    endDate?: string | null
  ): Promise<void>;
  getPendingSubscriptions(): Promise<(Subscription & { username: string })[]>;
}

export class MySQLStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [rows] = await pool.query(
        'SELECT id, username, password, is_repairman, is_admin, is_blocked FROM users WHERE id = ?',
        [id]
      );
      
      const users = rows as any[];
      if (users.length === 0) return undefined;
      
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
      throw new Error("Failed to get user: " + (error as Error).message);
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [rows] = await pool.query(
        'SELECT id, username, password, is_repairman, is_admin, is_blocked FROM users WHERE username = ?',
        [username]
      );
      
      const users = rows as any[];
      if (users.length === 0) return undefined;
      
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
      throw new Error("Failed to get user by username: " + (error as Error).message);
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      console.log("Creating user with data:", {
        username: insertUser.username,
        isRepairman: insertUser.isRepairman,
      });

      const [result] = await pool.query(
        'INSERT INTO users (username, password, is_repairman, is_admin, is_blocked, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          insertUser.username,
          insertUser.password,
          insertUser.isRepairman,
          insertUser.username === 'admin',
          insertUser.isBlocked || false,
          new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]
      );
      
      const newUser = result as any;
      
      console.log("User created successfully:", newUser.insertId);

      return {
        id: newUser.insertId,
        username: insertUser.username,
        password: insertUser.password,
        isRepairman: Boolean(insertUser.isRepairman),
        isAdmin: insertUser.username === "admin",
        isBlocked: Boolean(insertUser.isBlocked) || false,
      };
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error("Failed to create user: " + (error as Error).message);
    }
  }

  async createListing(
    listing: InsertListing & { userId: number },
  ): Promise<Listing> {
    try {
      const [result] = await pool.query(
        'INSERT INTO listings (user_id, title, description, category, image_url, budget, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          listing.userId,
          listing.title,
          listing.description,
          listing.category,
          listing.imageUrl,
          listing.budget,
          "open",
          new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]
      );
      
      const newListing = result as any;
      
      return {
        id: newListing.insertId,
        userId: listing.userId,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        imageUrl: listing.imageUrl || '', // Provide a default value if undefined
        status: "open",
        budget: listing.budget,
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
    } catch (error) {
      console.error("Error creating listing:", error);
      throw new Error("Failed to create listing: " + (error as Error).message);
    }
  }

  async getListing(id: number): Promise<Listing | undefined> {
    try {
      const [rows] = await pool.query(
        'SELECT id, user_id, title, description, category, image_url, status, budget, created_at FROM listings WHERE id = ?',
        [id]
      );
      
      const listings = rows as any[];
      if (listings.length === 0) return undefined;
      
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
        createdAt: listing.created_at,
      };
    } catch (error) {
      console.error("Error getting listing:", error);
      throw new Error("Failed to get listing: " + (error as Error).message);
    }
  }

  async getListings(): Promise<Listing[]> {
    try {
      const [rows] = await pool.query(
        'SELECT id, user_id, title, description, category, image_url, status, budget, created_at FROM listings'
      );
      
      const listings = rows as any[];
      return listings.map(listing => ({
        id: listing.id,
        userId: listing.user_id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        imageUrl: listing.image_url,
        status: listing.status,
        budget: listing.budget,
        createdAt: listing.created_at,
      }));
    } catch (error) {
      console.error("Error getting listings:", error);
      throw new Error("Failed to get listings: " + (error as Error).message);
    }
  }

  async getListingsByCategory(category: string): Promise<Listing[]> {
    try {
      const [rows] = await pool.query(
        'SELECT id, user_id, title, description, category, image_url, status, budget, created_at FROM listings WHERE category LIKE ?',
        [`%${category}%`]
      );
      
      const listings = rows as any[];
      return listings.map(listing => ({
        id: listing.id,
        userId: listing.user_id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        imageUrl: listing.image_url,
        status: listing.status,
        budget: listing.budget,
        createdAt: listing.created_at,
      }));
    } catch (error) {
      console.error("Error getting listings by category:", error);
      throw new Error("Failed to get listings by category: " + (error as Error).message);
    }
  }

  async createBid(
    bid: InsertBid & { listingId: number; repairmanId: number },
  ): Promise<Bid> {
    try {
      const [result] = await pool.query(
        'INSERT INTO bids (listing_id, repairman_id, amount, comment, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          bid.listingId,
          bid.repairmanId,
          bid.amount,
          bid.comment,
          "pending",
          new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]
      );
      
      const newBid = result as any;
      
      return {
        id: newBid.insertId,
        listingId: bid.listingId,
        repairmanId: bid.repairmanId,
        amount: bid.amount,
        comment: bid.comment,
        status: "pending",
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
    } catch (error) {
      console.error("Error creating bid:", error);
      throw new Error("Failed to create bid: " + (error as Error).message);
    }
  }

  async getBidsForListing(listingId: number): Promise<Bid[]> {
    try {
      const [rows] = await pool.query(
        'SELECT id, listing_id, repairman_id, amount, comment, status, created_at FROM bids WHERE listing_id = ?',
        [listingId]
      );
      
      const bids = rows as any[];
      return bids.map(bid => ({
        id: bid.id,
        listingId: bid.listing_id,
        repairmanId: bid.repairman_id,
        amount: bid.amount,
        comment: bid.comment,
        status: bid.status,
        createdAt: bid.created_at,
      }));
    } catch (error) {
      console.error("Error getting bids:", error);
      throw new Error("Failed to get bids: " + (error as Error).message);
    }
  }

  async deleteListing(id: number): Promise<void> {
    try {
      console.log("Attempting to delete listing:", id);
      
      // Start a transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // First delete related bids
        await connection.query('DELETE FROM bids WHERE listing_id = ?', [id]);
        
        // Then delete chat messages
        await connection.query('DELETE FROM chat_messages WHERE listing_id = ?', [id]);
        
        // Finally delete the listing
        await connection.query('DELETE FROM listings WHERE id = ?', [id]);
        
        // Commit the transaction
        await connection.commit();
        
        console.log("Successfully deleted listing:", id);
      } catch (error) {
        // Rollback the transaction in case of error
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Error deleting listing:", error);
      throw new Error("Failed to delete listing: " + (error as Error).message);
    }
  }

  async acceptBid(listingId: number, bidId: number): Promise<void> {
    try {
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // Update listing status
        await connection.query(
          'UPDATE listings SET status = ? WHERE id = ?',
          ["in_progress", listingId]
        );
        
        // Update bid status
        await connection.query(
          'UPDATE bids SET status = ? WHERE id = ? AND listing_id = ?',
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
      throw new Error("Failed to accept bid: " + (error as Error).message);
    }
  }

  async createChatMessage(
    message: InsertChatMessage & { listingId: number; senderId: number },
  ): Promise<ChatMessage> {
    try {
      const [result] = await pool.query(
        'INSERT INTO chat_messages (listing_id, sender_id, message, created_at) VALUES (?, ?, ?, ?)',
        [
          message.listingId,
          message.senderId,
          message.message,
          new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]
      );
      
      const newMessage = result as any;
      
      return {
        id: newMessage.insertId,
        listingId: message.listingId,
        senderId: message.senderId,
        message: message.message,
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
    } catch (error) {
      console.error("Error creating chat message:", error);
      throw new Error("Failed to create chat message: " + (error as Error).message);
    }
  }

  async getChatMessages(listingId: number): Promise<ChatMessage[]> {
    try {
      const [rows] = await pool.query(
        'SELECT id, listing_id, sender_id, message, created_at FROM chat_messages WHERE listing_id = ? ORDER BY created_at ASC',
        [listingId]
      );
      
      const messages = rows as any[];
      return messages.map(message => ({
        id: message.id,
        listingId: message.listing_id,
        senderId: message.sender_id,
        message: message.message,
        createdAt: message.created_at,
      }));
    } catch (error) {
      console.error("Error getting chat messages:", error);
      throw new Error("Failed to get chat messages: " + (error as Error).message);
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      const [rows] = await pool.query(
        'SELECT id, username, password, is_repairman, is_admin, is_blocked FROM users'
      );
      
      const users = rows as any[];
      return users.map(user => ({
        id: user.id,
        username: user.username,
        password: user.password,
        isRepairman: Boolean(user.is_repairman),
        isAdmin: Boolean(user.is_admin),
        isBlocked: Boolean(user.is_blocked),
      }));
    } catch (error) {
      console.error("Error getting users:", error);
      throw new Error("Failed to get users: " + (error as Error).message);
    }
  }

  async toggleUserBlock(userId: number): Promise<void> {
    try {
      // Get current user's blocked status
      const [rows] = await pool.query(
        'SELECT is_blocked FROM users WHERE id = ?',
        [userId]
      );
      
      const users = rows as any[];
      if (users.length === 0) throw new Error("User not found");
      
      const currentStatus = Boolean(users[0].is_blocked);
      
      // Toggle the blocked status
      await pool.query(
        'UPDATE users SET is_blocked = ? WHERE id = ?',
        [!currentStatus, userId]
      );
    } catch (error) {
      console.error("Error toggling user block status:", error);
      throw new Error("Failed to toggle user block status: " + (error as Error).message);
    }
  }

  async createReview(
    review: InsertReview & { listingId: number; repairmanId: number; userId: number },
  ): Promise<Review> {
    try {
      const [result] = await pool.query(
        'INSERT INTO reviews (listing_id, repairman_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          review.listingId,
          review.repairmanId,
          review.userId,
          review.rating,
          review.comment,
          new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]
      );
      
      const newReview = result as any;
      
      return {
        id: newReview.insertId,
        listingId: review.listingId,
        repairmanId: review.repairmanId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
    } catch (error) {
      console.error("Error creating review:", error);
      throw new Error("Failed to create review: " + (error as Error).message);
    }
  }

  async getReviewsForRepairman(repairmanId: number): Promise<Review[]> {
    try {
      const [rows] = await pool.query(
        'SELECT id, listing_id, repairman_id, user_id, rating, comment, created_at FROM reviews WHERE repairman_id = ? ORDER BY created_at DESC',
        [repairmanId]
      );
      
      const reviews = rows as any[];
      return reviews.map(review => ({
        id: review.id,
        listingId: review.listing_id,
        repairmanId: review.repairman_id,
        userId: review.user_id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.created_at,
      }));
    } catch (error) {
      console.error("Error getting reviews:", error);
      throw new Error("Failed to get reviews: " + (error as Error).message);
    }
  }

  async updateListingStatus(listingId: number, status: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE listings SET status = ? WHERE id = ?',
        [status, listingId]
      );
    } catch (error) {
      console.error("Error updating listing status:", error);
      throw new Error("Failed to update listing status: " + (error as Error).message);
    }
  }

  async getBidsForRepairman(repairmanId: number): Promise<Bid[]> {
    try {
      const [rows] = await pool.query(
        'SELECT id, listing_id, repairman_id, amount, comment, status, created_at FROM bids WHERE repairman_id = ? ORDER BY created_at DESC',
        [repairmanId]
      );
      
      const bids = rows as any[];
      return bids.map(bid => ({
        id: bid.id,
        listingId: bid.listing_id,
        repairmanId: bid.repairman_id,
        amount: bid.amount,
        comment: bid.comment,
        status: bid.status,
        createdAt: bid.created_at,
      }));
    } catch (error) {
      console.error("Error getting repairman's bids:", error);
      throw new Error("Failed to get repairman's bids: " + (error as Error).message);
    }
  }

  async getUsersByIds(ids: number[]): Promise<User[]> {
    try {
      if (ids.length === 0) return [];
      
      // Create placeholders for the query
      const placeholders = ids.map(() => '?').join(',');
      
      const [rows] = await pool.query(
        `SELECT id, username, password, is_repairman, is_admin, is_blocked FROM users WHERE id IN (${placeholders})`,
        ids
      );
      
      const users = rows as any[];
      return users.map(user => ({
        id: user.id,
        username: user.username,
        password: user.password,
        isRepairman: Boolean(user.is_repairman),
        isAdmin: Boolean(user.is_admin),
        isBlocked: Boolean(user.is_blocked),
      }));
    } catch (error) {
      console.error("Error getting users by ids:", error);
      throw new Error("Failed to get users by ids: " + (error as Error).message);
    }
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    try {
      console.log("Creating subscription with data:", {
        user_id: subscription.userId,
        amount: subscription.amount,
        payment_proof: subscription.paymentProof,
      });
  
      const [result] = await pool.query(
        'INSERT INTO subscriptions (user_id, amount, payment_proof, status, created_at) VALUES (?, ?, ?, ?, ?)',
        [
          subscription.userId,
          subscription.amount,
          subscription.paymentProof,
          "pending",
          new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]
      );
      
      const newSubscription = result as any;
      
      return {
        id: newSubscription.insertId,
        userId: subscription.userId,
        status: "pending",
        amount: subscription.amount,
        paymentProof: subscription.paymentProof,
        startDate: undefined, // Changed from null to undefined
        endDate: undefined,   // Changed from null to undefined
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
    } catch (error) {
      console.error("Error creating subscription:", error);
      throw new Error("Failed to create subscription: " + (error as Error).message);
    }
  }

  async getSubscription(userId: number): Promise<Subscription | undefined> {
    try {
      const [rows] = await pool.query(
        'SELECT id, user_id, status, amount, payment_proof, start_date, end_date, created_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      
      const subscriptions = rows as any[];
      if (subscriptions.length === 0) return undefined;
      
      const subscription = subscriptions[0];
      return {
        id: subscription.id,
        userId: subscription.user_id,
        status: subscription.status,
        amount: subscription.amount,
        paymentProof: subscription.payment_proof,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        createdAt: subscription.created_at,
      };
    } catch (error) {
      console.error("Error getting subscription:", error);
      throw new Error("Failed to get subscription: " + (error as Error).message);
    }
  }

  async updateSubscriptionStatus(
    subscriptionId: number,
    status: "active" | "expired",
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    try {
      // Format dates for MySQL if they are provided
      let formattedStartDate = startDate ? new Date(startDate).toISOString().slice(0, 19).replace('T', ' ') : null;
      let formattedEndDate = endDate ? new Date(endDate).toISOString().slice(0, 19).replace('T', ' ') : null;
      
      await pool.query(
        'UPDATE subscriptions SET status = ?, start_date = ?, end_date = ? WHERE id = ?',
        [status, formattedStartDate, formattedEndDate, subscriptionId]
      );
    } catch (error) {
      console.error("Error updating subscription status:", error);
      throw new Error("Failed to update subscription status: " + (error as Error).message);
    }
  }

  async getPendingSubscriptions(): Promise<(Subscription & { username: string })[]> {
    try {
      const [rows] = await pool.query(`
        SELECT s.id, s.user_id, s.status, s.amount, s.payment_proof, s.start_date, s.end_date, s.created_at, u.username
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE s.status = 'pending'
        ORDER BY s.created_at DESC
      `);
      
      const subscriptions = rows as any[];
      return subscriptions.map(subscription => ({
        id: subscription.id,
        userId: subscription.user_id,
        status: subscription.status,
        amount: subscription.amount,
        paymentProof: subscription.payment_proof,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        createdAt: subscription.created_at,
        username: subscription.username,
      }));
    } catch (error) {
      console.error("Error getting pending subscriptions:", error);
      throw new Error("Failed to get pending subscriptions: " + (error as Error).message);
    }
  }
}

export const storage = new MySQLStorage();
