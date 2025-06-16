import { db } from './db'; // Import the MySQL connection pool
import { log } from './vite'; // Import logging utility

export const initializeDatabase = async () => {
    try {
        // Test the database connection
        await db.getConnection();
        log('Database connection established successfully.');

        // Here you can add any migration logic if needed
        // For example, running SQL scripts to set up the schema

    } catch (error) {
        console.error('Error initializing database:', error);
        throw new Error('Database initialization failed');
    }
};
