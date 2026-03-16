// <thinking>
// I will demonstrate the "Side-Channel" concept with a simple analogy in code, showing how "Data-Dependent" logic can leak information through time.
// </thinking>

// // Conceptual: Why 'd' is faster/slower based on data
// function sideChannelLeak(password: string) {
//     const memory = [/* massive data */];
    
//     // In 'd' (Data-dependent), the index depends on the password
//     const index = password.charCodeAt(0) % 100;
    
//     const start = performance.now();
//     const value = memory[index]; // Accessing different parts of RAM takes different times
//     const end = performance.now();
    
//     // A thief measures (end - start) to guess the password's first letter
//     return value;
// }
