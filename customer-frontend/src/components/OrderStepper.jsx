import React from 'react';

const TRACKING_STAGES = [
  { key: 'ORDER_PLACED', label: 'Order Placed', icon: 'fa-cart-shopping' },
  { key: 'SELLER_DISPATCHED', label: 'Seller Dispatched', icon: 'fa-store' },
  { key: 'SHIPPED', label: 'Shipped to Hub', icon: 'fa-truck-fast' },
  { key: 'RECEIVED_AT_WAREHOUSE', label: 'Received at Warehouse', icon: 'fa-warehouse' },
  { key: 'OUT_FOR_DELIVERY', label: 'Agent Picked Up', icon: 'fa-motorcycle' },
  { key: 'DELIVERED', label: 'Delivered', icon: 'fa-circle-check' }
];

export default function OrderStepper({ currentStatus }) {
  let stages = [...TRACKING_STAGES];

  if (currentStatus === 'DOORSTEP_RETURNED') {
    stages[5] = { key: 'DOORSTEP_RETURNED', label: 'Doorstep Returned', icon: 'fa-rotate-left' };
  } else if (currentStatus === 'UNDELIVERED') {
    stages[5] = { key: 'UNDELIVERED', label: 'Unreachable (RTO)', icon: 'fa-phone-slash' };
  } else if (currentStatus === 'RTO_INITIATED') {
    stages[5] = { key: 'RTO_INITIATED', label: 'Returning to Hub', icon: 'fa-arrow-rotate-left' };
  }

  // Calculate current stage index
  let currentIndex = 0;
  if (currentStatus === 'PENDING') {
    currentIndex = 0; // Stage 1: Order Placed
  } else if (currentStatus === 'SELLER_ACCEPTED' || currentStatus === 'SELLER_DISPATCHED') {
    currentIndex = 1; // Stage 2: Seller Dispatched
  } else if (currentStatus === 'SHIPPED' || currentStatus === 'IN_TRANSIT_TO_WAREHOUSE') {
    currentIndex = 2; // Stage 3: Shipped to Hub
  } else if (currentStatus === 'RECEIVED_AT_WAREHOUSE' || currentStatus === 'WAREHOUSE_RECEIVED' || currentStatus === 'DELIVERY_REQUESTED' || currentStatus === 'AGENT_ASSIGNED') {
    currentIndex = 3; // Stage 4: Received at Warehouse
  } else if (currentStatus === 'PICKED_UP' || currentStatus === 'OUT_FOR_DELIVERY') {
    currentIndex = 4; // Stage 5: Agent Picked Up & Out for Delivery
  } else if (currentStatus === 'DELIVERED' || currentStatus === 'COMPLETED' || currentStatus === 'DOORSTEP_RETURNED' || currentStatus === 'UNDELIVERED' || currentStatus === 'RTO_INITIATED') {
    currentIndex = 5; // Stage 6: Delivered
  }

  return (
    <div className="stepper-container">
      {stages.map((stage, idx) => {
        const isPassedOrActive = idx <= currentIndex;
        const isException = (stage.key === 'DOORSTEP_RETURNED' || stage.key === 'UNDELIVERED' || stage.key === 'RTO_INITIATED') && idx === currentIndex;
        return (
          <div key={stage.key} className={`step-item ${isPassedOrActive ? 'active' : ''} ${isException ? 'exception' : ''}`}>
            <div className="step-icon" style={isException ? { background: '#EF4444', color: '#fff', borderColor: '#DC2626' } : {}}>
              <i className={`fa-solid ${stage.icon}`}></i>
            </div>
            <span className="step-label" style={isException ? { color: '#DC2626', fontWeight: '800' } : {}}>{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
}


