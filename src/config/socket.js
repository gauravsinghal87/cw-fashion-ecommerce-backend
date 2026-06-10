const { Server } = require('socket.io');
const setupSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: [process.env.CLIENT_URL, process.env.ADMIN_URL, process.env.VENDOR_URL], credentials: true },
  });
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('join-vendor', (vendorId) => socket.join(`vendor-${vendorId}`));
    socket.on('join-admin', () => socket.join('admin-room'));
    socket.on('join-user', (userId) => socket.join(`user-${userId}`));
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
  });
  return io;
};
module.exports = setupSocket;
