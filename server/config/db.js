const mongoose = require('mongoose');

const DATABASE_NAME_RULES = Object.freeze({
    development: {
        pattern: /(?:^|_)(?:dev|development|demo)$/i,
        expectedSuffixes: '_dev, _development, or _demo'
    },
    test: {
        pattern: /(?:^|_)test$/i,
        expectedSuffixes: '_test'
    },
    production: {
        pattern: /(?:^|_)(?:prod|production)$/i,
        expectedSuffixes: '_prod or _production'
    }
});

const databaseNameFromMongoUri = value => {
    try {
        const url = new URL(String(value || ''));
        if (!['mongodb:', 'mongodb+srv:'].includes(url.protocol)) return '';
        return decodeURIComponent(url.pathname.replace(/^\//, ''));
    } catch (_error) {
        return '';
    }
};

const buildDatabaseConfig = ({
    nodeEnv = process.env.NODE_ENV,
    mongoUri = process.env.MONGO_URI
} = {}) => {
    const environment = String(nodeEnv || '').trim().toLowerCase();
    const rule = DATABASE_NAME_RULES[environment];

    if (!rule) {
        throw new Error('NODE_ENV must be explicitly set to development, test, or production.');
    }
    if (!String(mongoUri || '').trim()) {
        throw new Error('MONGO_URI is required.');
    }

    const databaseName = databaseNameFromMongoUri(mongoUri);
    if (!databaseName) {
        throw new Error('MONGO_URI must be a valid MongoDB URI with an explicit database name.');
    }
    if (!rule.pattern.test(databaseName)) {
        throw new Error(
            `Database "${databaseName}" is not allowed for NODE_ENV=${environment}. `
            + `Use a database name ending in ${rule.expectedSuffixes}.`
        );
    }

    return {
        environment,
        databaseName,
        mongoUri,
        options: {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: environment === 'production' ? 20 : 10
        }
    };
};

const redactMongoUris = value => String(value || '')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s'"`]+/gi, '[redacted MongoDB URI]');

const formatDatabaseConnectionError = (config, error) => {
    const detail = redactMongoUris(error?.message || 'Unknown connection error.');
    return `MongoDB connection failed for NODE_ENV=${config.environment}, database="${config.databaseName}": ${detail}`;
};

const connectDB = async (config = buildDatabaseConfig()) => {
    try {
        await mongoose.connect(config.mongoUri, config.options);
        console.log(`MongoDB connected for NODE_ENV=${config.environment}, database="${config.databaseName}".`);
        return mongoose.connection;
    } catch (error) {
        throw new Error(formatDatabaseConnectionError(config, error));
    }
};

module.exports = connectDB;
module.exports.DATABASE_NAME_RULES = DATABASE_NAME_RULES;
module.exports.databaseNameFromMongoUri = databaseNameFromMongoUri;
module.exports.buildDatabaseConfig = buildDatabaseConfig;
module.exports.redactMongoUris = redactMongoUris;
module.exports.formatDatabaseConnectionError = formatDatabaseConnectionError;
