
console.log("L_key exists:", !!process.env.L_key);
if (process.env.L_key) {
  console.log("L_key length:", process.env.L_key.length);
  console.log("L_key masked:", process.env.L_key.substring(0, 4) + "..." + process.env.L_key.substring(process.env.L_key.length - 4));
}
