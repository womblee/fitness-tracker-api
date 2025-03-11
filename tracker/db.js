const mysql = require('mysql2');

// Create a connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'rango',
    password: 'Rangomango8',
    database: 'tracker',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Convert pool to use promises
const promise_pool = pool.promise();

const table_queries = `
    CREATE TABLE IF NOT EXISTS users (
        userID INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        iv VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workouts (
        workoutID INT AUTO_INCREMENT PRIMARY KEY,
        userID INT NOT NULL,
        workoutName VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userID) REFERENCES users(userID) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS workout_completions (
        completionID INT AUTO_INCREMENT PRIMARY KEY,
        workoutID INT NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workoutID) REFERENCES workouts(workoutID) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exercises (
        exerciseID INT AUTO_INCREMENT PRIMARY KEY,
        workoutID INT NOT NULL,
        exerciseName VARCHAR(255) NOT NULL,
        FOREIGN KEY (workoutID) REFERENCES workouts(workoutID) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exercise_sets (
        setID INT AUTO_INCREMENT PRIMARY KEY,
        exerciseID INT NOT NULL,
        setNumber INT NOT NULL,
        reps INT NOT NULL,
        weight DECIMAL(5, 2),
        FOREIGN KEY (exerciseID) REFERENCES exercises(exerciseID) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exercise_set_completions (
        set_completion_id INT AUTO_INCREMENT PRIMARY KEY,
        setID INT NOT NULL,
        workoutID INT NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (setID) REFERENCES exercise_sets(setID) ON DELETE CASCADE,
        FOREIGN KEY (workoutID) REFERENCES workouts(workoutID) ON DELETE CASCADE
    );
`;

async function exec_query(query, params)
{
    try
    {
        console.log('Executing query:', query, 'with params:', params);
        const [results] = await promise_pool.execute(query, params);
        console.log('Query results:', results);
        return results;
    }
    catch (err)
    {
        console.error('Database query error:', err);
        throw err;
    }
}

async function db_ensure()
{
    try
    {
        // Test connection first
        console.log('Testing database connection...');
        try
        {
            const [rows] = await pool.promise().query('SELECT 1');
            console.log('Database connection successful');
        }
        catch (err)
        {
            console.error('Database connection failed:', err);
            throw new Error('Failed to connect to database');
        }

        // Proceed with table creation
        console.log('Creating/verifying tables...');
        const queries = table_queries
            .split(';')
            .map(query => query.trim())
            .filter(query => query.length > 0);

        for (const query of queries)
            {
            try
            {
                await pool.promise().execute(query);
                console.log(`Executed query successfully: ${query}`);
            }
            catch (err)
            {
                console.error(`Failed to execute query: ${query}`);
            }
        }
        
        console.log('All tables created/verified successfully.');
        return true;
    }
    catch (err)
    {
        console.error('Database initialization failed:', err.message);
        throw err; // Rethrow to handle in the calling code
    }
}

// Export the pool
module.exports = {
    pool,
    db_ensure,
    exec_query
};