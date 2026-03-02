import argon2 from 'argon2';

async function theExperiment() {
    const password = "my-secret-password";
    // The Salt must be a Buffer. We fix it to 16 zeros for this test.
    const manualSalt = Buffer.alloc(16, 0); 

    // 1. The Strong Lock (High Memory)
    const strongHash = await argon2.hash(password, {
        salt: manualSalt,
        memoryCost: 65536, // 64MB
        timeCost: 3,
        type: argon2.argon2id
    });

    // 2. The Weak Key (Low Memory)
    const weakHash = await argon2.hash(password, {
        salt: manualSalt,
        memoryCost: 4096, // 4MB - A different "recipe"
        timeCost: 3,
        type: argon2.argon2id
    });

    console.log(`Strong Hash: ${strongHash}`);
    console.log(`Weak Hash:   ${weakHash}`);

    if (strongHash !== weakHash) {
        console.log("\nInsight: Even with the SAME SALT, the result is different!");
        console.log("The 'Dust' depends on the work performed, not just the starting ingredients.");
    }
}

theExperiment();