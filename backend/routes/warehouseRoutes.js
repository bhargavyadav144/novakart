import express from 'express';
import {
  getAllWarehouses,
  getNearestWarehouse,
  getWarehouseById,
  getMyWarehouse,
  updateMyWarehouse,
  getWarehouseShipments,
  updateShipmentStage,
  getWarehouseRiders,
  onboardWarehouseRider,
  resetRiderTempPassword,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  updateWarehouseManagerPassword,
  getWarehouseCredentials,
  updateWarehouseServiceArea,
  getWarehouseZones,
  createOrUpdateWarehouseZone,
  deleteWarehouseZone,
  assignRiderToZone,
  detectAreaPincodesAndMandal,
  checkServiceability,
  getMandalOrderDemand
} from '../controllers/warehouseController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// 1. Manager Dedicated Endpoints (Before /:id)
router.get('/my-warehouse', authenticateUser, getMyWarehouse);
router.put('/my-warehouse', authenticateUser, updateMyWarehouse);
router.get('/my-warehouse/shipments', authenticateUser, getWarehouseShipments);
router.put('/my-warehouse/shipments/:orderId/stage', authenticateUser, updateShipmentStage);

// Fleet, Territory Zones & Rider Onboarding Management
router.get('/my-warehouse/riders', authenticateUser, getWarehouseRiders);
router.post('/my-warehouse/riders', authenticateUser, onboardWarehouseRider);
router.put('/my-warehouse/riders/:id/reset-temp-password', authenticateUser, resetRiderTempPassword);

// Territory Zones Management
router.get('/my-warehouse/zones', authenticateUser, getWarehouseZones);
router.get('/my-warehouse/mandal-demand', authenticateUser, getMandalOrderDemand);
router.post('/my-warehouse/zones', authenticateUser, createOrUpdateWarehouseZone);
router.delete('/my-warehouse/zones/:zoneId', authenticateUser, deleteWarehouseZone);
router.post('/my-warehouse/detect-area-pincodes', authenticateUser, detectAreaPincodesAndMandal);
router.put('/my-warehouse/riders/:agentId/assign-zone', authenticateUser, assignRiderToZone);


// 2. Public & General Queries
router.get('/', getAllWarehouses);
router.get('/check-serviceability', checkServiceability);
router.get('/nearest', getNearestWarehouse);
router.get('/:id', getWarehouseById);

// 3. Admin-Only Management
router.post('/', authenticateUser, authorizeRoles(ROLES.ADMIN), createWarehouse);
router.get('/:id/credentials', authenticateUser, authorizeRoles(ROLES.ADMIN), getWarehouseCredentials);
router.put('/:id/manager-password', authenticateUser, authorizeRoles(ROLES.ADMIN), updateWarehouseManagerPassword);
router.put('/:id/service-area', authenticateUser, authorizeRoles(ROLES.ADMIN), updateWarehouseServiceArea);
router.put('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), updateWarehouse);
router.delete('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), deleteWarehouse);

export default router;
