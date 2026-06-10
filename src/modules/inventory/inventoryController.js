const Inventory = require('../inventory/Inventory');
const InventoryTransaction = require('../inventory/InventoryTransaction');
const Warehouse = require('../warehouses/Warehouse');
const Product = require('../products/Product');
const Vendor = require('../vendors/Vendor');

const getVendor = async (userId) => {
  const vendor = await Vendor.findOne({ user: userId });
  if (!vendor) throw new Error('Vendor profile not found');
  return vendor;
};

const recordTransaction = async ({ vendor, warehouse, product, variantSku, type, quantity, available, reserved, damaged, note, referenceId, referenceModel, userId }) => {
  await InventoryTransaction.create({
    vendor, warehouse, product, variantSku, type, quantity,
    availableBefore: available?.before ?? 0, availableAfter: available?.after ?? 0,
    reservedBefore: reserved?.before ?? 0, reservedAfter: reserved?.after ?? 0,
    damagedBefore: damaged?.before ?? 0, damagedAfter: damaged?.after ?? 0,
    note, referenceId, referenceModel, createdBy: userId,
  });
};

const getInventoryList = async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user._id);
    const { q, warehouse: warehouseId, lowStock } = req.query;
    const filter = { vendor: vendor._id };
    if (warehouseId) filter.warehouse = warehouseId;
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$availableStock', '$lowStockThreshold'] };
    }
    const inventory = await Inventory.find(filter)
      .populate('warehouse', 'name city')
      .populate('product', 'title images')
      .sort('variantSku');
    let result = inventory;
    if (q) {
      const lower = q.toLowerCase();
      result = inventory.filter(i =>
        i.variantSku?.toLowerCase().includes(lower) ||
        i.variantLabel?.toLowerCase().includes(lower) ||
        i.product?.title?.toLowerCase().includes(lower)
      );
    }
    res.json({ success: true, inventory: result });
  } catch (error) { next(error); }
};

const getWarehouseInventory = async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user._id);
    const inventory = await Inventory.find({ vendor: vendor._id, warehouse: req.params.warehouseId })
      .populate('product', 'title images')
      .sort('variantSku');
    res.json({ success: true, inventory });
  } catch (error) { next(error); }
};

const addStock = async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user._id);
    const { productId, sku, warehouseId, quantity, note } = req.body;
    if (!productId || !sku || !warehouseId || !quantity) {
      return res.status(400).json({ success: false, message: 'productId, sku, warehouseId, and quantity required' });
    }
    const wh = await Warehouse.findOne({ _id: warehouseId, vendor: vendor._id });
    if (!wh) return res.status(404).json({ success: false, message: 'Warehouse not found' });
    const product = await Product.findOne({ _id: productId, vendor: vendor._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const variant = product.variants.find(v => v.sku === sku);
    if (!variant) return res.status(404).json({ success: false, message: 'Variant SKU not found' });
    const label = [variant.color, variant.size].filter(Boolean).join(' / ');

    let inv = await Inventory.findOne({ vendor: vendor._id, warehouse: warehouseId, product: productId, variantSku: sku });
    const before = inv?.availableStock || 0;
    if (inv) {
      inv.availableStock += Number(quantity);
      await inv.save();
    } else {
      inv = await Inventory.create({
        vendor: vendor._id, warehouse: warehouseId, product: productId, variantSku: sku,
        variantLabel: label, availableStock: Number(quantity),
      });
    }

    await recordTransaction({
      vendor: vendor._id, warehouse: warehouseId, product: productId, variantSku: sku,
      type: 'stock_in', quantity: Number(quantity),
      available: { before, after: inv.availableStock },
      note: note || 'Stock added', userId: req.user._id,
    });

    variant.stock = (variant.stock || 0) + Number(quantity);
    variant.availableStock = variant.stock;
    await product.save();

    res.json({ success: true, inventory: inv });
  } catch (error) { next(error); }
};

const removeStock = async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user._id);
    const { productId, sku, warehouseId, quantity, note, type } = req.body;
    if (!productId || !sku || !warehouseId || !quantity) {
      return res.status(400).json({ success: false, message: 'productId, sku, warehouseId, and quantity required' });
    }
    const inv = await Inventory.findOne({ vendor: vendor._id, warehouse: warehouseId, product: productId, variantSku: sku });
    if (!inv) return res.status(404).json({ success: false, message: 'Inventory record not found' });
    if (inv.availableStock < Number(quantity)) {
      return res.status(400).json({ success: false, message: `Insufficient stock. Available: ${inv.availableStock}` });
    }
    const before = inv.availableStock;
    inv.availableStock -= Number(quantity);
    await inv.save();

    const txnType = type || 'stock_out';
    await recordTransaction({
      vendor: vendor._id, warehouse: warehouseId, product: productId, variantSku: sku,
      type: txnType, quantity: Number(quantity),
      available: { before, after: inv.availableStock },
      note: note || 'Stock removed', userId: req.user._id,
    });

    const product = await Product.findOne({ _id: productId, vendor: vendor._id });
    if (product) {
      const variant = product.variants.find(v => v.sku === sku);
      if (variant) {
        variant.stock = Math.max(0, (variant.stock || 0) - Number(quantity));
        variant.availableStock = variant.stock;
        await product.save();
      }
    }

    res.json({ success: true, inventory: inv });
  } catch (error) { next(error); }
};

const transferStock = async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user._id);
    const { productId, sku, fromWarehouseId, toWarehouseId, quantity, note } = req.body;
    if (!productId || !sku || !fromWarehouseId || !toWarehouseId || !quantity) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    if (fromWarehouseId === toWarehouseId) {
      return res.status(400).json({ success: false, message: 'Source and destination warehouses must differ' });
    }

    const fromInv = await Inventory.findOne({ vendor: vendor._id, warehouse: fromWarehouseId, product: productId, variantSku: sku });
    if (!fromInv || fromInv.availableStock < Number(quantity)) {
      return res.status(400).json({ success: false, message: `Insufficient stock in source warehouse. Available: ${fromInv?.availableStock || 0}` });
    }

    const fromBefore = fromInv.availableStock;
    fromInv.availableStock -= Number(quantity);
    await fromInv.save();

    let toInv = await Inventory.findOne({ vendor: vendor._id, warehouse: toWarehouseId, product: productId, variantSku: sku });
    const toBefore = toInv?.availableStock || 0;
    if (toInv) {
      toInv.availableStock += Number(quantity);
      await toInv.save();
    } else {
      const product = await Product.findOne({ _id: productId, vendor: vendor._id });
      const variant = product?.variants.find(v => v.sku === sku);
      toInv = await Inventory.create({
        vendor: vendor._id, warehouse: toWarehouseId, product: productId, variantSku: sku,
        variantLabel: variant ? [variant.color, variant.size].filter(Boolean).join(' / ') : '',
        availableStock: Number(quantity),
      });
    }

    await recordTransaction({
      vendor: vendor._id, warehouse: fromWarehouseId, product: productId, variantSku: sku,
      type: 'transfer_out', quantity: Number(quantity),
      available: { before: fromBefore, after: fromInv.availableStock },
      note: `Transferred ${quantity} units to ${toInv.warehouse}${note ? ' - ' + note : ''}`, userId: req.user._id,
    });
    await recordTransaction({
      vendor: vendor._id, warehouse: toWarehouseId, product: productId, variantSku: sku,
      type: 'transfer_in', quantity: Number(quantity),
      available: { before: toBefore, after: toInv.availableStock },
      note: `Received ${quantity} units from ${fromInv.warehouse}${note ? ' - ' + note : ''}`, userId: req.user._id,
    });

    res.json({ success: true, from: fromInv, to: toInv });
  } catch (error) { next(error); }
};

const markDamaged = async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user._id);
    const { productId, sku, warehouseId, quantity, note } = req.body;
    const inv = await Inventory.findOne({ vendor: vendor._id, warehouse: warehouseId, product: productId, variantSku: sku });
    if (!inv || inv.availableStock < Number(quantity)) {
      return res.status(400).json({ success: false, message: 'Insufficient available stock' });
    }
    const availBefore = inv.availableStock;
    const damagedBefore = inv.damagedStock;
    inv.availableStock -= Number(quantity);
    inv.damagedStock = (inv.damagedStock || 0) + Number(quantity);
    await inv.save();

    await recordTransaction({
      vendor: vendor._id, warehouse: warehouseId, product: productId, variantSku: sku,
      type: 'damaged', quantity: Number(quantity),
      available: { before: availBefore, after: inv.availableStock },
      damaged: { before: damagedBefore, after: inv.damagedStock },
      note: note || 'Marked as damaged', userId: req.user._id,
    });

    res.json({ success: true, inventory: inv });
  } catch (error) { next(error); }
};

const getInventoryHistory = async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user._id);
    const { warehouse: warehouseId, sku, type, limit: qLimit, page: qPage } = req.query;
    const filter = { vendor: vendor._id };
    if (warehouseId) filter.warehouse = warehouseId;
    if (sku) filter.variantSku = sku;
    if (type) filter.type = type;
    const page = parseInt(qPage) || 1;
    const limit = parseInt(qLimit) || 50;
    const transactions = await InventoryTransaction.find(filter)
      .populate('warehouse', 'name')
      .populate('product', 'title images')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await InventoryTransaction.countDocuments(filter);
    res.json({
      success: true, transactions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};

const getLowStockAlerts = async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user._id);
    const alerts = await Inventory.find({
      vendor: vendor._id,
      $expr: { $lte: ['$availableStock', '$lowStockThreshold'] },
    }).populate('warehouse', 'name').populate('product', 'title images');
    res.json({ success: true, alerts });
  } catch (error) { next(error); }
};

const getInventoryDashboard = async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user._id);
    const [totalProducts, totalStock, lowStockItems, outOfStockItems, warehouseCount] = await Promise.all([
      Inventory.distinct('product', { vendor: vendor._id }),
      Inventory.aggregate([{ $match: { vendor: vendor._id } }, { $group: { _id: null, total: { $sum: '$availableStock' } } }]),
      Inventory.countDocuments({ vendor: vendor._id, $expr: { $lte: ['$availableStock', '$lowStockThreshold'] }, availableStock: { $gt: 0 } }),
      Inventory.countDocuments({ vendor: vendor._id, availableStock: 0 }),
      Warehouse.countDocuments({ vendor: vendor._id, isActive: true }),
    ]);
    res.json({
      success: true,
      stats: {
        totalProducts: totalProducts.length,
        totalStock: totalStock[0]?.total || 0,
        lowStockItems,
        outOfStockItems,
        warehouseCount,
      },
    });
  } catch (error) { next(error); }
};

const bulkImport = async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user._id);
    const { items } = req.body;
    if (!items || !items.length) return res.status(400).json({ success: false, message: 'No items provided' });
    const results = { imported: 0, skipped: 0, errors: [] };
    for (const item of items) {
      try {
        const { sku, warehouseName, quantity } = item;
        if (!sku || !warehouseName || quantity === undefined) {
          results.errors.push({ sku, message: 'Missing required fields (sku, warehouseName, quantity)' });
          results.skipped++; continue;
        }
        const product = await Product.findOne({ vendor: vendor._id, 'variants.sku': sku });
        if (!product) { results.errors.push({ sku, message: 'No product found with this SKU' }); results.skipped++; continue; }
        const warehouse = await Warehouse.findOne({ vendor: vendor._id, name: warehouseName });
        if (!warehouse) { results.errors.push({ sku, message: `Warehouse "${warehouseName}" not found` }); results.skipped++; continue; }
        const variant = product.variants.find(v => v.sku === sku);
        let inv = await Inventory.findOne({ vendor: vendor._id, warehouse: warehouse._id, product: product._id, variantSku: sku });
        const before = inv?.availableStock || 0;
        if (inv) { inv.availableStock += Number(quantity); await inv.save(); }
        else {
          inv = await Inventory.create({
            vendor: vendor._id, warehouse: warehouse._id, product: product._id, variantSku: sku,
            variantLabel: [variant?.color, variant?.size].filter(Boolean).join(' / ') || '',
            availableStock: Number(quantity),
          });
        }
        await recordTransaction({
          vendor: vendor._id, warehouse: warehouse._id, product: product._id, variantSku: sku,
          type: 'stock_in', quantity: Number(quantity),
          available: { before, after: inv.availableStock },
          note: 'Bulk import', userId: req.user._id,
        });
        variant.stock = (variant.stock || 0) + Number(quantity);
        variant.availableStock = variant.stock;
        await product.save();
        results.imported++;
      } catch (err) {
        results.errors.push({ sku: item.sku, message: err.message });
        results.skipped++;
      }
    }
    res.json({ success: true, ...results });
  } catch (error) { next(error); }
};

module.exports = {
  getInventoryList, getWarehouseInventory, addStock, removeStock, transferStock, markDamaged,
  getInventoryHistory, getLowStockAlerts, getInventoryDashboard, bulkImport,
};
