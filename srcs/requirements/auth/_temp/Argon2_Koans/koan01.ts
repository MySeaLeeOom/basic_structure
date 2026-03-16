import { createHash } from 'crypto';

// The Stone: The raw secret provided by the user
const password = "password-123";

// The Grinding: Turning the stone into dust
function basicHash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

const dust1 = basicHash(password);
const dust2 = basicHash(password);

console.log(`Original Stone: ${password}`);
console.log(`One Grind:  ${dust1}`);
console.log(`Other Grind: ${dust2}`);
console.log(`Match? ${dust1 === dust2 ? "Yes, the dust is identical." : "No."}`);

// Scaffolding to show the "One-Way" nature
try {
    // There is no function: unhash(dust1) -> "my-secret-password"
    console.log("Attempting to turn dust back into stone... Error: The path is one-way.");
} catch (e) {
    // Silence of the void
}
