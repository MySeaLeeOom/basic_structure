import argon2 from 'argon2';

async function chooseYourPath() {
    const password = "my-secret-password";

    // Argon2i: The Scholar. Resists timing attacks.
    const hashI = await argon2.hash(password, { type: argon2.argon2i });

    // Argon2d: The Warrior. Resists GPU cracking.
    const hashD = await argon2.hash(password, { type: argon2.argon2d });

    // Argon2id: The Master. Balanced and complete.
    const hashID = await argon2.hash(password, { type: argon2.argon2id });

    console.log(`Argon2i:  ${hashI.substring(0, 30)}...`);
    console.log(`Argon2d:  ${hashD.substring(0, 30)}...`);
    console.log(`Argon2id: ${hashID.substring(0, 30)}...`);
}

chooseYourPath();
