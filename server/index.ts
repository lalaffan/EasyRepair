import express, { type Request, Response, NextFunction } from "express";
import { createPool } from "mysql2/promise";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import dotenv from "dotenv";


// Load environment variables
dotenv.config();

// Create MySQL connection pool
export const db = createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'easyrepair',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Basic request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
  });
  next();
});

// Test MySQL connection
app.get("/api/db-test", async (req: Request, res: Response) => {
  try {
    const [result] = await db.query("SELECT 1 as connection_test");
    res.json({
      success: true,
      message: "Database connection successful",
      data: result
    });
  } catch (error: any) {
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
    log('Starting server...');
    
    // Verify database connection on startup
    try {
      log('Testing database connection...');
      const [rows] = await db.query('SELECT 1 as connection_test');
      log('Database connection established successfully');
    } catch (dbError) {
      console.error('Failed to connect to MySQL database:', dbError);
      process.exit(1);
    }

    const server = await registerRoutes(app);
    log('Routes registered successfully');

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // In development mode, use Vite's dev server
    log('Setting up Vite development server');
    await setupVite(app, server);

    const port = parseInt(process.env.PORT || "5000", 10);

      server.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port}`);
      log(`MySQL connection established to ${process.env.DB_HOST || 'localhost'}`);
      if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        log(`Access your server at: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
        log(`Test endpoint available at: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/ping`);
        log(`Database connection test: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/db-test`);
      }
    }).on('error', (err) => {
      console.error('Server startup error:', err);
      process.exit(1);
    });

  } catch (error) {
    console.error('Fatal error during server startup:', error);
    process.exit(1);
  }
})();
