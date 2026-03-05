import { createHash } from 'crypto';
import argon2 from 'argon2';

async function theTrap() {
    const password = "my-secret-password";

    // 1. We create the true "Dust" using Argon2
    const secureHash = await argon2.hash(password);

    // 2. The Thief tries to use a "Fast" algorithm to guess it
    const thiefGuess = "my-secret-password";
    const fastHashAttempt = createHash('sha256').update(thiefGuess).digest('hex');

    console.log(`Stored Secure Hash: ${secureHash}`);
    console.log(`Thief's Fast Hash:  ${fastHashAttempt}`);

    if (secureHash !== fastHashAttempt) {
        console.log("\nResult: The Thief fails.");
        console.log("The lock is Argon2 shaped. A SHA-256 key will never turn it,");
        console.log("even if the password 'stone' is correct.");
    }
}

theTrap();