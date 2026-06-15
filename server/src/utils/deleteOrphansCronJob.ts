import cron from 'node-cron';
import db from '../db/db';
import { sql } from 'drizzle-orm';
import { files } from '../db/schema';
import deleteFileService from '../services/files/manage/deleteFileService';

// Run at 3:00 AM
cron.schedule('0 3 * * *', async () => {
    console.log("Running Orphaned File Sweeper");

    try {
        // Find all files that are incomplete and older than 24 hours
        const orphanedFiles = await db
            .select({ id: files.id, owner_id: files.ownerId })
            .from(files)
            .where(sql`
                ${files.uploadedBytes} < ${files.fileSize} 
                AND created_at < NOW() - INTERVAL '24 hours'
            `);

        let deletedCount = 0;

        for (const file of orphanedFiles) {
            try {
                await deleteFileService(file.owner_id,file.id, true);
                deletedCount++;
            } catch (err) {
                console.error(`Failed to sweep file ${file.id}:`, err);
            }
        }

        console.log(`Sweeper finished. Cleaned up ${deletedCount} orphaned files.`);
    } catch (error) {
        console.error("Fatal error in sweeper cron job:", error);
    }
});