const generateOrderNumber = () => {
  const prefix = 'LXF';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

const generateInvoiceNumber = () => {
  const prefix = 'INV';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${date}${random}`;
};

module.exports = { generateOrderNumber, generateInvoiceNumber };
