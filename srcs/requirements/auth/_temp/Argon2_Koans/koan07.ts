import argon2 from 'argon2';

// THE TEMPORARY POND (Our Simulated Database)
const mockDB = {
    userStore: {
        "student_id": "" // We will fill this soon
    }
};

// THE CLIENT (Browser)
async function clientSendsPassword(rawPassword: string) {
    console.log("[Client] Hashing on frontend...");
    // The student's idea: hash before sending
    return await argon2.hash(rawPassword);
}

// THE SERVER (Microservice)
async function serverReceivesLogin(receivedHash: string) {
    console.log("[Server] Checking incoming hash against DB...");
    const storedHash = mockDB.userStore["student_id"];

    // THE VULNERABILITY: 
    // If the server just compares the two, the hash is effectively a plain-text password.
    if (receivedHash === storedHash) {
        return "SUCCESS: Logged in.";
    } else {
        return "FAILURE: Unauthorized.";
    }
}

async function theSimulation() {
    const originalSecret = "zen-master-123";

    // 1. Registration Phase
    console.log("--- Phase 1: Registration ---");
    const registrationHash = await clientSendsPassword(originalSecret);
    mockDB.userStore["student_id"] = registrationHash;
    console.log(`DB now stores: ${registrationHash}\n`);

    // 2. Legitimate Login
    console.log("--- Phase 2: Legitimate Login ---");
    const loginHash = await clientSendsPassword(originalSecret);
    const result = await serverReceivesLogin(loginHash);
    console.log(`Result: ${result}\n`);

    // 3. THE REPLAY ATTACK (The Thief)
    console.log("--- Phase 3: The Thief ---");
    console.log("Thief intercepts the hash from the network. They don't know the 'stone' (password).");
    const stolenHash = registrationHash; // Thief didn't hash anything, they just 'caught' it.
    
    const evilResult = await serverReceivesLogin(stolenHash);
    console.log(`Thief Result: ${evilResult}`);
    console.log("Insight: The thief entered without ever knowing the password.");
}

theSimulation();