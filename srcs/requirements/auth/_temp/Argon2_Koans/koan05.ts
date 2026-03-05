import argon2 from 'argon2';

async function demonstrateParallelism() {
    const password = "my-secret-password";

    // Scenario A: One hand doing all the work
    console.time("One Lane");
    await argon2.hash(password, {
        parallelism: 1,
        memoryCost: 65536,
        timeCost: 3
    });
    console.timeEnd("One Lane");

    // Scenario B: Four hands working together
    // Note: On a multi-core machine, this may be faster, 
    // but it requires more hardware resources simultaneously.
    console.time("Four Lanes");
    await argon2.hash(password, {
        parallelism: 4,
        memoryCost: 65536,
        timeCost: 3
    });
    console.timeEnd("Four Lanes");
}

demonstrateParallelism();
