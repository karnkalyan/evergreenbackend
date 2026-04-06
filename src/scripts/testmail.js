const { testEmailConnection } = require('../cron/emailProcessor');
testEmailConnection().then(() => {
  console.log('Email test passed!');
}).catch(error => {
  console.log('Email test failed:', error.message);
});