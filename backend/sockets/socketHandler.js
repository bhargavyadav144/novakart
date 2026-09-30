import { DeliveryAgent } from '../models/DeliveryAgent.js';

let ioInstance = null;

export const configureSockets = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`[Socket Connected]: ${socket.id}`);

    // User / Portal joining their specific room
    socket.on('join_user_room', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} joined room user_${userId}`);
      }
    });

    // Support Agent joining support staff channel
    socket.on('join_support_room', (workerId) => {
      socket.join('support_staff');
      if (workerId) socket.join(`worker_${workerId}`);
      console.log(`Support Worker ${workerId || socket.id} joined support_staff`);
    });

    // Seller joining their store notification channel
    socket.on('join_seller_room', (sellerId) => {
      if (sellerId) {
        socket.join(`seller_${sellerId}`);
        console.log(`Socket ${socket.id} joined seller_${sellerId}`);
      }
    });

    // Delivery agent joining the live delivery radar
    socket.on('join_delivery_radar', (agentId) => {
      socket.join('delivery_radar');
      if (agentId) {
        socket.join(`user_${agentId}`);
      }
      console.log(`Agent ${agentId || socket.id} joined delivery_radar`);
    });

    // Admin joining the platform monitoring channel
    socket.on('join_admin_room', () => {
      socket.join('admin_monitoring');
      socket.join('support_staff');
      console.log(`Admin joined admin_monitoring and support_staff channel`);
    });

    // Warehouse Manager joining warehouse fleet command channel
    socket.on('join_warehouse_fleet', (warehouseId) => {
      if (warehouseId) {
        socket.join(`warehouse_fleet_${warehouseId}`);
        console.log(`Warehouse Manager ${socket.id} joined warehouse_fleet_${warehouseId}`);
      }
    });

    // Real-time GPS coordinate stream from Delivery Agent
    socket.on('update_agent_location', async ({ agentId, lat, lng, address, speed, heading, orderId }) => {
      try {
        if (agentId && lat && lng) {
          const agent = await DeliveryAgent.findOneAndUpdate(
            { $or: [{ userId: agentId }, { _id: agentId }] },
            {
              'currentLocation.lat': lat,
              'currentLocation.lng': lng,
              'currentLocation.address': address || 'Live GPS Position',
              'currentLocation.lastUpdated': new Date()
            },
            { new: true }
          );

          const payload = {
            agentId: agent?._id || agentId,
            agentName: agent?.fullName,
            phone: agent?.phone,
            vehicleNumber: agent?.vehicleNumber,
            vehicleType: agent?.vehicleType,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            address: address || 'Live GPS Position',
            speed: speed || 30,
            heading: heading || 0,
            assignedZone: agent?.assignedZone,
            activeOrdersCount: agent?.activeOrderIds?.length || (agent?.activeOrderId ? 1 : 0),
            updatedAt: new Date()
          };

          // Broadcast to Admin
          io.to('admin_monitoring').emit('agent_location_stream', payload);

          // Broadcast to Warehouse Fleet Channel
          if (agent?.assignedWarehouse) {
            io.to(`warehouse_fleet_${agent.assignedWarehouse}`).emit('agent_live_location', payload);
          }

          // Broadcast to specific Order Room for real-time Customer Tracking
          const targetOrderId = orderId || agent?.activeOrderId;
          if (targetOrderId) {
            io.to(`order_${targetOrderId}`).emit('rider_live_location', payload);
          }
        }
      } catch (err) {
        console.error('Failed to update live agent coordinates:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket Disconnected]: ${socket.id}`);
    });
  });
};

export const getIO = () => ioInstance;

