import argon2 from 'argon2';

async function secureLogin(userAttempt: string, storedHashFromDB: string) {
    const modernOptions = {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        type: argon2.argon2id
    };

    // 1. THE GATEKEEPER: Always verify first
    const isCorrect = await argon2.verify(storedHashFromDB, userAttempt);

    if (!isCorrect) {
        console.log("Access Denied: The stone does not match the dust.");
        return { success: false };
    }

    // 2. THE ARCHITECT: Only runs if the password was correct
    // We check if the stored hash used weaker settings than our 'modernOptions'
    if (argon2.needsRehash(storedHashFromDB, modernOptions)) {
        console.log("Upgrade Required: Strengthening the user's protection...");
        
        // We use the 'userAttempt' (the raw password) to make a brand new, stronger hash
        const upgradedHash = await argon2.hash(userAttempt, modernOptions);
        
        // Return success PLUS the new hash to be saved in the database
        return { success: true, newHash: upgradedHash };
    }

    return { success: true, newHash: null };
}

// --- SIMULATION ---
async function runTest() {
    // Imagine this came from a DB record created 5 years ago
    const oldWeakHash = await argon2.hash("password123", { memoryCost: 8192 });

    console.log("--- Attempting Login ---");
    const result = await secureLogin("password123", oldWeakHash);

    if (result.success) {
        console.log("Login successful!");
        if (result.newHash) {
            console.log("DB Action: Overwrite the old hash with this new one.");
        }
    }
}

runTest();