const {
    DATABASE_NAME_RULES,
    databaseNameFromMongoUri,
    buildDatabaseConfig,
    redactMongoUris,
    formatDatabaseConnectionError
} = require('../config/db');

describe('Database configuration - environment isolation', () => {
    test('extracts the database name from standard and SRV MongoDB URIs', () => {
        expect(databaseNameFromMongoUri('mongodb://localhost:27017/gems_test')).toBe('gems_test');
        expect(databaseNameFromMongoUri('mongodb+srv://user:secret@example.mongodb.net/gems_demo?retryWrites=true'))
            .toBe('gems_demo');
    });

    test.each([
        ['development', 'gems_dev'],
        ['development', 'gems_development'],
        ['development', 'gems_demo'],
        ['test', 'gems_test'],
        ['production', 'gems_prod'],
        ['production', 'gems_production']
    ])('allows NODE_ENV=%s to use %s', (nodeEnv, databaseName) => {
        const config = buildDatabaseConfig({
            nodeEnv,
            mongoUri: `mongodb://localhost:27017/${databaseName}`
        });

        expect(config).toMatchObject({ environment: nodeEnv, databaseName });
        expect(config.mongoUri).toBe(`mongodb://localhost:27017/${databaseName}`);
    });

    test.each([
        ['development', 'gems_test'],
        ['development', 'gems_production'],
        ['test', 'gems_development'],
        ['test', 'gems_production'],
        ['production', 'gems_development'],
        ['production', 'gems_demo']
    ])('rejects NODE_ENV=%s with database %s', (nodeEnv, databaseName) => {
        expect(() => buildDatabaseConfig({
            nodeEnv,
            mongoUri: `mongodb://localhost:27017/${databaseName}`
        })).toThrow(`Database "${databaseName}" is not allowed for NODE_ENV=${nodeEnv}.`);
    });

    test.each([
        { nodeEnv: null, mongoUri: null },
        { nodeEnv: 'staging', mongoUri: 'mongodb://localhost:27017/gems_dev' },
        { nodeEnv: 'development', mongoUri: '' },
        { nodeEnv: 'development', mongoUri: 'not-a-uri' },
        { nodeEnv: 'development', mongoUri: 'https://example.com/gems_development' },
        { nodeEnv: 'development', mongoUri: 'mongodb://localhost:27017' }
    ])('rejects missing or unsupported configuration %#', input => {
        expect(() => buildDatabaseConfig(input)).toThrow();
    });

    test('uses bounded connection timeouts and a larger production connection pool', () => {
        const development = buildDatabaseConfig({
            nodeEnv: 'development',
            mongoUri: 'mongodb://localhost:27017/gems_development'
        });
        const production = buildDatabaseConfig({
            nodeEnv: 'production',
            mongoUri: 'mongodb://localhost:27017/gems_production'
        });

        expect(development.options).toEqual({
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10
        });
        expect(production.options.maxPoolSize).toBe(20);
    });

    test('defines a naming rule for every supported runtime environment', () => {
        expect(Object.keys(DATABASE_NAME_RULES)).toEqual(['development', 'test', 'production']);
    });
});

describe('Database configuration - credential-safe errors', () => {
    test('redacts complete MongoDB URIs from driver messages', () => {
        const uri = 'mongodb+srv://database-user:super-secret@example.mongodb.net/gems_production?retryWrites=true';
        const config = buildDatabaseConfig({ nodeEnv: 'production', mongoUri: uri });
        const message = formatDatabaseConnectionError(config, new Error(`Unable to reach ${uri}`));

        expect(message).toContain('NODE_ENV=production');
        expect(message).toContain('database="gems_production"');
        expect(message).toContain('[redacted MongoDB URI]');
        expect(message).not.toContain('database-user');
        expect(message).not.toContain('super-secret');
    });

    test('redacts MongoDB URIs in arbitrary text without changing ordinary errors', () => {
        expect(redactMongoUris('Failed mongodb://user:secret@localhost:27017/gems_test'))
            .toBe('Failed [redacted MongoDB URI]');
        expect(redactMongoUris('Connection timed out.')).toBe('Connection timed out.');
    });
});
