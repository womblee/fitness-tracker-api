const jwt = require('jsonwebtoken');
const { exec_query } = require('./db');
const validator = require('../utils/validator');
const aes_encryption = require('../utils/aes')

// Web token secret
const JWT_SECRET = process.env.JWT_SECRET;

async function run_handlers(app)
{
    // Sessions
    app.post('/login', async (req, res) => {
        const { username, password, remember_me } = req.body;
    
        try
        {
            // Get user from database
            const result = await exec_query('SELECT * FROM users WHERE username = ?', [username]);
            
            if (result.length === 0)
                return res.status(401).json({ message: 'Invalid credentials' });
    
            const user = result[0];
            
            // Decrypt and verify password
            const encryption = new aes_encryption();
            const decrypted_password = encryption.decrypt(user.password, user.iv);
    
            if (password !== decrypted_password)
                return res.status(401).json({ message: 'Invalid credentials' });
    
            // Set token expiration based on remember_me
            const expiration = remember_me ? '30d' : '24h'; // 30 days or 24 hours
    
            // Create JWT token with expiration
            const token = jwt.sign(
                { 
                    userID: user.userID,
                    username: user.username,
                    remember_me: remember_me // Include this in token for reference
                },
                JWT_SECRET,
                { expiresIn: expiration }
            );
    
            // Return token and expiration info to client
            res.json({
                success: true,
                token: token,
                expiresIn: remember_me ? '30 days' : '24 hours'
            });
    
        }
        catch (err)
        {
            console.error('Login error:', err);
            res.status(500).json({ message: 'Server error', error: err.message });
        }
    });

    // Middleware to verify JWT token
    const authenticate_token = (req, res, next) => {
        const auth_header = req.headers['authorization'];
        const token = auth_header && auth_header.split(' ')[1]; // Bearer TOKEN
    
        if (!token)
            return res.status(401).json({ message: 'Authentication required' });
    
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err)
                return res.status(403).json({ message: 'Invalid or expired token' });
    
            // Add user info to request object
            req.user = user;
            next();
        });
    };

    // User functions
    app.post('/register', async (req, res) => {
        const { username, password } = req.body;
        console.log(`Initiating registration: ${username} / ${password}`);

        try
        {
            const result = await exec_query('SELECT * FROM users WHERE username = ?', [username]);
            if (result.length === 0)
            {
                const validation = new validator();

                // Verify username
                if (!validation.is_username_valid(username))
                    return res.status(400).json({ message: 'Username must contain: minimum 6 characters, maximum 20 characters, only english letters (a-z, A-Z), numbers (0-9), and underscores (_).' });
                
                // Verify password
                if (!validation.is_password_valid(password))
                    return res.status(400).json({ message: 'Password must be: minimum 8 characters, maximum 32 characters, must include at least one uppercase letter, one lowercase letter, one digit, and one special character' });
                
                // Encrypt password
                const encryption = new aes_encryption();
                const { encrypted_data: encrypted_password, iv } = encryption.encrypt(password);

                // Registration
                const query = `
                    INSERT INTO users (username, password, iv)
                    VALUES (?, ?, ?)
                `;
                const values = [username, encrypted_password, iv];
            
                // Step 3: Execute the Query
                const result = await exec_query(query, values);
            
                // Step 4: Return Success Response
                return res.status(201).json({ success: true, message: 'User registered successfully' });
            }
            else
            {
                return res.status(400).json({ message: 'That username is already taken' });
            }
        }
        catch (err)
        {
            console.error('Error executing query:', err);
            res.status(500).json({ message: 'Server error', error: err.message });
        }
    });
    
    app.put('/change_password', authenticate_token, async (req, res) => {
        const { current_password, new_password } = req.body;

        try
        {
            // Retrieve user_id from JWT payload
            const { userID } = req.user;

            console.log(`Initiating password change: ${userID} / ${current_password} / ${new_password}`);

            // Fetch user from database using userID
            const result = await exec_query('SELECT * FROM users WHERE user_id = ?', [userID]);

            if (result.length === 0)
                return res.status(404).json({ message: 'User not found' });
                        
            // Retrieve the first user
            const user = result[0];

            // Decrypt
            const encryption = new aes_encryption();
            const decrypted_password = encryption.decrypt(user.token, user.iv);
            
            // Validate
            if (decrypted_password !== current_password)
                return res.status(400).json({ message: 'Old password is incorrect' });

            if (!validation.is_password_valid(new_password))
                return res.status(400).json({ message: 'Password must be: minimum 8 characters, maximum 32 characters, must include at least one uppercase letter, one lowercase letter, one digit, and one special character' });
           
            // Encrypt
            const { encrypted_data: encrypted_new_password, iv: new_iv } = encryption.encrypt(new_password);

            // Update
            const query = `
                UPDATE users
                SET password = ?, iv = ?
                WHERE user_id = ?
            `;
            const values = [encrypted_new_password, new_iv, userID];
    
            await exec_query(query, values);
    
            // Step 7: Return Success Response
            return res.status(200).json({ message: 'Password updated successfully' });
        }
        catch (err)
        {
            console.error('Error executing query:', err);
            res.status(500).json({ message: 'Server error', error: err.message });
        }
    });

    // Fitness functions
    app.post('/workout/create', authenticate_token, async (req, res) => {
        const { workout_name, user_id } = req.body;
        
        try
        {
            // Validate input
            if (!workout_name || !user_id)
                return res.status(400).json({ message: 'Workout name and user ID are required' });
    
            // Create workout
            const createQuery = `
                INSERT INTO workouts (userID, workoutName)
                VALUES (?, ?)
            `;
            
            const result = await exec_query(createQuery, [userID, workoutName]);
            
            return res.status(201).json({
                success: true,
                message: 'Workout created successfully',
                workoutID: result.insertId
            });
        }
        catch (err)
        {
            console.error('Error creating workout:', err);
            return res.status(500).json({ message: 'Server error', error: err.message });
        }
    });

    // Endpoint to mark a workout as completed for the current day
    app.post('/workout/complete', authenticate_token, async (req, res) => {
        const { workout_id } = req.body;
        
        try
        {
            // Check if workout exists
            const workout_query = 'SELECT * FROM workouts WHERE workoutID = ?';
            const workout = await exec_query(workout_query, [workout_id]);
            
            if (workout.length === 0)
                return res.status(404).json({ message: 'Workout not found' });
    
            // Get all completion records for this workout
            const completion_history_query = `
                SELECT completionID, completed_at 
                FROM workout_completions 
                WHERE workoutID = ?
                ORDER BY completed_at DESC
            `;
            
            const completion_history = await exec_query(completion_history_query, [workout_id]);
    
            // Check if trying to modify a past completion
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            
            for (const completion of completion_history)
            {
                const completion_date = new Date(completion.completed_at).toISOString().split('T')[0];
                if (completion_date < today)
                {
                    return res.status(403).json({
                        success: false,
                        message: 'Cannot modify completion status for past dates. The completion status can only be changed on the same day it was recorded.'
                    });
                }
            }
        
            // Check if workout has a completion status for today
            const check_completion_query = `
                SELECT completionID 
                FROM workout_completions 
                WHERE workoutID = ? 
                AND DATE(completed_at) = ?
            `;
            
            const existing_completion = await exec_query(check_completion_query, [workout_id, today]);
            
            if (existing_completion.length > 0)
            {
                // If completion exists for today, remove it (toggle off)
                const delete_query = `
                    DELETE FROM workout_completions 
                    WHERE completionID = ?
                `;
                
                await exec_query(delete_query, [existing_completion[0].completionID]);
                
                return res.status(200).json({
                    success: true,
                    message: 'Workout completion removed for today',
                    completed: false
                });
            }
            else
            {
                // If no completion exists for today, add it (toggle on)
                const complete_query = `
                    INSERT INTO workout_completions (workoutID)
                    VALUES (?)
                `;
                
                await exec_query(complete_query, [workout_id]);
                
                return res.status(200).json({
                    success: true,
                    message: 'Workout marked as completed for today',
                    completed: true
                });
            }
        }
        catch (err)
        {
            console.error('Error toggling workout completion:', err);
            return res.status(500).json({ message: 'Server error', error: err.message });
        }
    });

    app.post('/workout/:workout_id/exercise', authenticate_token, async (req, res) => {
        const { workout_id } = req.params;
        const { exercise_name, sets } = req.body;
        
        // Expected request body format:
        // {
        //     "exercise_name": "Bench Press",
        //     "sets": [
        //         { "set_number": 1, "reps": 10, "weight": 135.00 },
        //         { "set_number": 2, "reps": 8, "weight": 145.00 }
        //     ]
        // }
        
        try
        {
            // Validate input
            if (!exercise_name)
            {
                return res.status(400).json({ 
                    message: 'Exercise name is required' 
                });
            }
    
            if (!sets || !Array.isArray(sets) || sets.length === 0)
            {
                return res.status(400).json({ 
                    message: 'At least one set is required' 
                });
            }
    
            // Verify workout exists
            const workoutQuery = `
                SELECT workoutID 
                FROM workouts 
                WHERE workoutID = ?
            `;
            
            const workout = await exec_query(workoutQuery, [workout_id]);
            
            if (workout.length === 0) {
                return res.status(404).json({ 
                    message: 'Workout not found' 
                });
            }
    
            // Start transaction
            await exec_query('START TRANSACTION', []);
    
            try
            {
                // Create the exercise
                const createExerciseQuery = `
                    INSERT INTO exercises (workoutID, exerciseName)
                    VALUES (?, ?)
                `;
                
                const exerciseResult = await exec_query(
                    createExerciseQuery, 
                    [workout_id, exercise_name]
                );
                
                const exerciseId = exerciseResult.insertId;
    
                // Create all sets for this exercise
                const createSetQuery = `
                    INSERT INTO exercise_sets 
                    (exerciseID, setNumber, reps, weight)
                    VALUES (?, ?, ?, ?)
                `;
                
                for (const set of sets)
                {
                    if (!set.set_number || !set.reps)
                        throw new Error('Each set must have a set number and reps');
    
                    await exec_query(
                        createSetQuery, 
                        [exerciseId, set.set_number, set.reps, set.weight || null]
                    );
                }
    
                // Commit the transaction
                await exec_query('COMMIT', []);
                
                // Get the complete exercise data with its sets
                const getExerciseQuery = `
                    SELECT 
                        e.exerciseID,
                        e.exerciseName,
                        es.setID,
                        es.setNumber,
                        es.reps,
                        es.weight
                    FROM exercises e
                    LEFT JOIN exercise_sets es ON e.exerciseID = es.exerciseID
                    WHERE e.exerciseID = ?
                    ORDER BY es.setNumber
                `;
                
                const exerciseData = await exec_query(getExerciseQuery, [exerciseId]);
                
                // Format the response
                const response = {
                    exercise_id: exerciseData[0].exerciseID,
                    exercise_name: exerciseData[0].exerciseName,
                    sets: exerciseData.map(row => ({
                        set_id: row.setID,
                        set_number: row.setNumber,
                        reps: row.reps,
                        weight: row.weight
                    }))
                };
    
                return res.status(201).json({
                    success: true,
                    message: 'Exercise created successfully',
                    data: response
                });
    
            }
            catch (error)
            {
                // If anything fails, roll back the transaction
                await exec_query('ROLLBACK', []);
                throw error;
            }
        }
        catch (err)
        {
            console.error('Error creating exercise:', err);
            return res.status(500).json({ 
                message: 'Server error', 
                error: err.message 
            });
        }
    });

    app.post('/exercise/set/complete', authenticate_token, async (req, res) => {
        const { workout_id, exercise_id, set_id } = req.body;
        
        try
        {
            // Validate input
            if (!workout_id || !exercise_id || !set_id)
            {
                return res.status(400).json({ 
                    message: 'Workout ID, exercise ID, and set ID are required' 
                });
            }
    
            // Verify the set belongs to the specified exercise and workout
            const verifyQuery = `
                SELECT es.setID 
                FROM exercise_sets es
                JOIN exercises e ON es.exerciseID = e.exerciseID
                WHERE es.setID = ? 
                AND es.exerciseID = ? 
                AND e.workoutID = ?
            `;
            
            const verifyResult = await exec_query(verifyQuery, [set_id, exercise_id, workout_id]);
            
            if (verifyResult.length === 0)
            {
                return res.status(404).json({ 
                    message: 'Invalid combination of workout, exercise, and set IDs' 
                });
            }
    
            // Check if set has been completed today
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            
            const checkCompletionQuery = `
                SELECT set_completion_id 
                FROM exercise_set_completions 
                WHERE setID = ? 
                AND workoutID = ?
                AND DATE(completed_at) = ?
            `;
            
            const existingCompletion = await exec_query(
                checkCompletionQuery, 
                [set_id, workout_id, today]
            );
    
            if (existingCompletion.length > 0)
            {
                // Remove completion if it exists (toggle off)
                const deleteQuery = `
                    DELETE FROM exercise_set_completions 
                    WHERE set_completion_id = ?
                `;
                
                await exec_query(deleteQuery, [existingCompletion[0].set_completion_id]);
                
                return res.status(200).json({
                    success: true,
                    message: 'Exercise set completion removed for today',
                    completed: false
                });
            }
            else
            {
                // Add completion if it doesn't exist (toggle on)
                const completeQuery = `
                    INSERT INTO exercise_set_completions (setID, workoutID)
                    VALUES (?, ?)
                `;
                
                await exec_query(completeQuery, [set_id, workout_id]);
                
                return res.status(200).json({
                    success: true,
                    message: 'Exercise set marked as completed for today',
                    completed: true
                });
            }
        }
        catch (err)
        {
            console.error('Error toggling exercise set completion:', err);
            return res.status(500).json({ message: 'Server error', error: err.message });
        }
    });

    app.get('/workout/:workout_id/completion-status', authenticate_token, async (req, res) => {
        const { workout_id } = req.params;
        
        try
        {
            const today = new Date().toISOString().split('T')[0];
            
            const statusQuery = `
                SELECT 
                    w.workoutID,
                    w.workoutName,
                    e.exerciseID,
                    e.exerciseName,
                    es.setID,
                    es.setNumber,
                    es.reps,
                    es.weight,
                    CASE 
                        WHEN esc.set_completion_id IS NOT NULL THEN true 
                        ELSE false 
                    END as is_completed
                FROM workouts w
                JOIN exercises e ON w.workoutID = e.workoutID
                JOIN exercise_sets es ON e.exerciseID = es.exerciseID
                LEFT JOIN exercise_set_completions esc ON es.setID = esc.setID
                    AND esc.workoutID = w.workoutID
                    AND DATE(esc.completed_at) = ?
                WHERE w.workoutID = ?
                ORDER BY e.exerciseID, es.setNumber
            `;
            
            const results = await exec_query(statusQuery, [today, workout_id]);
            
            if (results.length === 0)
            {
                return res.status(404).json({ 
                    message: 'Workout not found or has no exercises' 
                });
            }
    
            // Format the results into a nested structure
            const formattedResponse = {
                workout_id: results[0].workoutID,
                workout_name: results[0].workoutName,
                exercises: {}
            };
    
            results.forEach(row =>
            {
                if (!formattedResponse.exercises[row.exerciseID]) {
                    formattedResponse.exercises[row.exerciseID] = {
                        exercise_id: row.exerciseID,
                        exercise_name: row.exerciseName,
                        sets: []
                    };
                }
                
                formattedResponse.exercises[row.exerciseID].sets.push({
                    set_id: row.setID,
                    set_number: row.setNumber,
                    reps: row.reps,
                    weight: row.weight,
                    completed: row.is_completed
                });
            });
    
            return res.status(200).json(formattedResponse);
        }
        catch (err)
        {
            console.error('Error getting workout completion status:', err);
            return res.status(500).json({ 
                message: 'Server error', 
                error: err.message 
            });
        }
    });
}

module.exports = run_handlers;