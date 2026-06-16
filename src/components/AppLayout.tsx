import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileTabBar } from './MobileTabBar';
import { MAIN_MOBILE_NAV_PB_CLASS } from '../constants/mobileNavLayout';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex h-[100dvh] min-h-0 bg-background-darker">
      <Sidebar />
      <main
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${MAIN_MOBILE_NAV_PB_CLASS} lg:pb-0`}
      >
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  );
};
