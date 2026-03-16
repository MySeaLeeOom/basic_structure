import argon2 from 'argon2';

async function completeSimulation() {
    const password = "correct-horse-battery-staple";

    // 1. REGISTRATION: We create a REAL hash
    // This string will be long and full of information.
    const realStoredHash = await argon2.hash(password);
    console.log("Full Stored Hash:", realStoredHash);

    // 2. THE TEST: Checking a correct password
    const isMatch = await argon2.verify(realStoredHash, password);
    console.log(`\nCorrect password check: ${isMatch}`); // Should be true

    // 3. THE TEST: Checking a wrong password
    const isWrongMatch = await argon2.verify(realStoredHash, "wrong-password");
    console.log(`Wrong password check: ${isWrongMatch}`); // Should be false
}

completeSimulation();
 