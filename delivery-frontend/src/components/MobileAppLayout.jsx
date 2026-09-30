import React from 'react';
import MobileDeliveryTopBar from './MobileDeliveryTopBar';
import DeliveryBottomNav from './DeliveryBottomNav';
import BarcodeScannerModal from './BarcodeScannerModal';
import { useDeliveryAuth } from '../context/DeliveryAuthContext';

import DraggableSpeedometer from './DraggableSpeedometer';

export default function MobileAppLayout({ children, activeOrdersCount: propCount }) {
  const { isScanModalOpen, openScanner, closeScanner, fetchActiveCount, activeOrdersCount: contextCount } = useDeliveryAuth() || {};
  const activeOrdersCount = propCount !== undefined ? propCount : (contextCount || 0);

  const handleOrderClaimedFromNavScan = () => {
    if (closeScanner) closeScanner();
    if (fetchActiveCount) fetchActiveCount();
  };

  return (
    <div className="mobile-viewport-wrapper">
      {/* Phone Screen Ratio Container (Pure mobile screen ratio, no phone shape/chassis) */}
      <div className="delivery-mobile-container">
        
        {/* Compact Fleet App Bar */}
        <MobileDeliveryTopBar />

        {/* Scrollable Screen Body */}
        <div className="delivery-screen-body">
          {children}
        </div>

        {/* Draggable Speedometer Circle Badge */}
        <DraggableSpeedometer />

        {/* Bottom Nav with Labeled Items */}
        <DeliveryBottomNav
          onOpenScanner={openScanner}
          activeOrdersCount={activeOrdersCount}
        />

        {/* Global Barcode Scanner Modal */}
        <BarcodeScannerModal
          isOpen={isScanModalOpen}
          onClose={closeScanner}
          onOrderClaimed={handleOrderClaimedFromNavScan}
        />

      </div>
    </div>
  );
}
