class validator
{
    is_username_valid(username)
    {
        const usernameRegex = /^[a-zA-Z0-9_]{6,20}$/;
        return usernameRegex.test(username);
    }

    is_password_valid(password)
    {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{8,32}$/;
        return passwordRegex.test(password);
    }
}

module.exports = validator;