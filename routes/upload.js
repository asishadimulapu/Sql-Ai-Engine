/**
 * Upload Routes
 * Handle file uploads and convert to queryable tables
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const {
    parseFile,
    createTableFromData,
    deleteUploadedTable,
    listUploadedTables,
    MAX_FILE_SIZE
} = require('../services/fileUpload');
const { asyncHandler } = require('../middleware/errorHandler');
const { clearAllCache } = require('../utils/cache');
const logger = require('../utils/logger');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not supported. Allowed: ${allowedTypes.join(', ')}`), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter
});

/**
 * @route   POST /api/upload
 * @desc    Upload file and create queryable table
 * @access  Public
 */
router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No file uploaded'
        });
    }

    logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);

    try {
        // Parse the file
        const parsed = await parseFile(req.file);

        // Get database connection
        const db = req.app.get('db');

        // Create table from data
        const result = await createTableFromData(
            db,
            parsed.tableName,
            parsed.data,
            parsed.columns
        );

        // Clear schema cache so new table shows up
        clearAllCache();

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        logger.info(`Created table ${result.tableName} with ${result.rowCount} rows`);

        res.json({
            success: true,
            message: `File uploaded successfully! Table "${result.tableName}" created.`,
            table: {
                name: result.tableName,
                originalFile: parsed.originalName,
                columns: result.columns,
                rowCount: result.rowCount
            }
        });

    } catch (error) {
        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        throw error;
    }
}));

/**
 * @route   GET /api/upload
 * @desc    List all uploaded tables
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
    const db = req.app.get('db');
    const dbType = req.app.get('dbType');

    const tables = await listUploadedTables(db, dbType);

    res.json({
        success: true,
        uploadedTables: tables,
        count: tables.length
    });
}));

/**
 * @route   DELETE /api/upload/:tableName
 * @desc    Delete an uploaded table
 * @access  Public
 */
router.delete('/:tableName', asyncHandler(async (req, res) => {
    const { tableName } = req.params;
    const db = req.app.get('db');

    await deleteUploadedTable(db, tableName);

    // Clear schema cache
    clearAllCache();

    logger.info(`Deleted uploaded table: ${tableName}`);

    res.json({
        success: true,
        message: `Table "${tableName}" deleted successfully`
    });
}));

// Error handler for multer errors
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
            });
        }
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
    next(error);
});

module.exports = router;
