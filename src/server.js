require('dotenv').config();
const http = require('http');
const app = require('./app');
const setupSocket = require('./config/socket');

const server = http.createServer(app);
const io = setupSocket(server);
app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
