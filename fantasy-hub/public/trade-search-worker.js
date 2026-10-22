'use strict';
importScripts('analytics-math.js?v=9.12.1');
self.onmessage=event=>{const {own,their,slots,week,mode}=event.data;self.postMessage(FantasyMath.searchTrades(own,their,slots,week,mode));};
