import argon2 from 'argon2';

async function demonstrateSalt() {
    const password = "same-password-123";

    // We hash the exact same string twice
    const hash1 = await argon2.hash(password);
    const hash2 = await argon2.hash(password);

    console.log(`Password: ${password}`);
    console.log(`Result 1: ${hash1}`);
    console.log(`Result 2: ${hash2}`);

    if (hash1 !== hash2) {
        console.log("\nInsight: The dust is different every time!");
        console.log("Even though the stone was the same, the mountain changed.");
    }
}

demonstrateSalt();