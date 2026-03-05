// <thinking>
// I will demonstrate that while the hashing is happening on multiple threads, the main JavaScript thread remains "unblocked" and can still do other things. This proves that the threads are happening in the background (C++ layer).
// </thinking>

//Parallelist Demo - threads using C++ vs single threaded node.js

import argon2 from 'argon2';

async function demonstrateThreads() {
    console.log("Starting a heavy Argon2 hash with 4 threads...");

    // We start the hash but DON'T await it immediately
    const hashPromise = argon2.hash("password", {
        parallelism: 4,
        memoryCost: 2 ** 18, // 256MB - A heavy lift
        timeCost: 10
    });

    // This interval proves the "Main Thread" (Event Loop) is still alive
    const interval = setInterval(() => {
        console.log("Main JS Thread: I am still awake and responsive!");
    }, 100);

    const result = await hashPromise;
    
    clearInterval(interval);
    console.log("Hash finished.");
}

demonstrateThreads();