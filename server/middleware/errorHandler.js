function errorHandler(err, req, res, next) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack:  err.stack }),
    });
}

module.exports = errorHandler;