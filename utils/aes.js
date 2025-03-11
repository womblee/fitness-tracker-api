const crypto = require('crypto');
require('dotenv').config();

class aes_encryption
{
    constructor() {
        if (!process.env.AES_KEY) {
            throw new Error('AES_KEY is not set in the .env file');
        }

        // Convert HEX key from .env file to Buffer
        this.KEY = Buffer.from(process.env.AES_KEY, 'hex');

        // Validate key length
        if (this.KEY.length !== 32) {
            throw new Error('Invalid AES_KEY length. Expected 32 bytes (64 HEX characters).');
        }
    }

    encrypt(data)
    {
        // Generate a random IV (Initialization Vector)
        const iv = crypto.randomBytes(16); // 16 bytes IV for AES-256-CBC
        const cipher = crypto.createCipheriv('aes-256-cbc', this.KEY, iv);
        
        // Encrypt the data
        let encrypted = cipher.update(data, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        // Return encrypted data along with IV (to be stored or transmitted)
        return {
            encrypted_data: encrypted,
            iv: iv.toString('base64') // Store IV in base64 format
        };
    }

    decrypt(encrypted_data, iv_base_64)
    {
        const iv = Buffer.from(iv_base_64, 'base64'); // Convert the IV from base64 to buffer
        
        // Validate IV length (should be 16 bytes)
        if (iv.length !== 16)
        {
            throw new Error('Invalid IV length. Expected 16 bytes.');
        }

        const decipher = crypto.createDecipheriv('aes-256-cbc', this.KEY, iv);
        
        // Decrypt the data
        let decrypted = decipher.update(encrypted_data, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    get_key() {
        return this.KEY.toString('hex');
    }
}

module.exports = aes_encryption;