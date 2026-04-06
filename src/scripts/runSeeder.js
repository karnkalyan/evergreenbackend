// src/scripts/runSeeder.js
const { seedEmailAutomation } = require('./seedEmailAutomation');

console.log('🚀 Running email automation seeder...');

seedEmailAutomation()
  .then(() => {
    console.log('✅ Seeder completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeder failed:', error.message);
    process.exit(1);
  });