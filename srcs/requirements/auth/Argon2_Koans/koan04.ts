import argon2 from 'argon2';

async function demonstrateMemory() {
    const password = "my-secret-password";

    console.log("Requesting 128MB of memory for a single hash...");
    
    // memoryCost is in KiB. 131072 KiB = 128 MiB
    const start = Date.now();
    const hash = await argon2.hash(password, {
        memoryCost: 131072, 
        timeCost: 3,
        parallelism: 1
    });
    const end = Date.now();

    console.log(`Hash complete.`);
    console.log(`Memory Used: 128MB`);
    console.log(`Time Taken: ${end - start}ms`);
}

demonstrateMemory();